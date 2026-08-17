import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { verifiedFxRate } from "../fx";
import { normalizeCountryCode } from "../shipping";
import { PLATFORM_CJ_CONNECTION_ID } from "./supplier-access";
import { calculateSupplierVariantPriceWithFreight, convertSupplierPriceForBuyer } from "./pricing";
import { defaultSupplierMediaProvider, importSupplierProduct } from "./supplier-products";
import { catalogComplianceDecision, publicCatalogError, resolveCatalogCategory } from "./supplier-catalog-policy";
import type { SupplierCatalogProvider, SupplierProductSnapshot } from "./types";

export const MAX_CATALOG_JOB_ITEMS=500;
export const DEFAULT_CATALOG_PROCESS_LIMIT=3;
export const MAX_CATALOG_PROCESS_LIMIT=10;
const STALE_CLAIM_MS=15*60_000;

function boundedInteger(value:unknown,fallback:number,maximum:number){const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,maximum):fallback;}
export function catalogIdentifiers(value:unknown){const values=(Array.isArray(value)?value:typeof value==="string"?value.split(/[\s,;]+/):[]).map((item)=>String(item).trim()).filter(Boolean);if(values.some((item)=>!/^[A-Za-z0-9-]{4,200}$/.test(item)))throw new Error("SUPPLIER_BULK_INPUT_INVALID");return[...new Set(values)];}

export async function createCatalogImportJob(db:PrismaClient,input:{adminId:string;storeId:string;identifiers:unknown;destinationCountry:unknown;canonicalCategoryId?:string|null;batchLimit?:unknown}){
  const identifiers=catalogIdentifiers(input.identifiers),destinationCountry=normalizeCountryCode(input.destinationCountry),batchLimit=boundedInteger(input.batchLimit,DEFAULT_CATALOG_PROCESS_LIMIT,MAX_CATALOG_PROCESS_LIMIT);
  if(!identifiers.length||identifiers.length>MAX_CATALOG_JOB_ITEMS)throw new Error(identifiers.length>MAX_CATALOG_JOB_ITEMS?"SUPPLIER_BULK_LIMIT_EXCEEDED":"SUPPLIER_BULK_INPUT_INVALID");
  const category=resolveCatalogCategory({categoryReference:null,title:""},input.canonicalCategoryId);
  if(input.canonicalCategoryId&&!category.categoryId)throw new Error("CANONICAL_CATEGORY_INVALID");
  return db.supplierCatalogImportJob.create({data:{createdById:input.adminId,storeId:input.storeId,destinationCountry,requestedCount:identifiers.length,batchLimit,items:{create:identifiers.map((requestedIdentifier,position)=>({requestedIdentifier,position,canonicalCategoryId:category.categoryId,categoryMappingSource:category.categoryId?category.source:null,categoryMappingReason:category.categoryId?category.reason:null}))}},select:{id:true,status:true,requestedCount:true,batchLimit:true,destinationCountry:true,createdAt:true}});
}

async function verifiedCatalogPricing(provider:SupplierCatalogProvider,snapshot:SupplierProductSnapshot,destinationCountry:string,sellingCurrency:string){
  if(!provider.calculateFreight)throw new Error("CJ_FREIGHT_UNAVAILABLE");
  const variant=snapshot.variants.find((candidate)=>candidate.available&&candidate.cost!=null&&candidate.originCountryCodes.length===1);
  if(!variant)throw new Error("DROPSHIPPING_ORIGIN_OR_COST_UNAVAILABLE");
  const freight=await provider.calculateFreight({originCountry:variant.originCountryCodes[0],destinationCountry,variantId:variant.supplierVariantId,quantity:1});
  const calculation=calculateSupplierVariantPriceWithFreight(snapshot,variant.supplierVariantId,{amount:freight.selected.amount,currency:freight.selected.currency});
  const fx=await verifiedFxRate(calculation.sellingCurrency,sellingCurrency),presentment=convertSupplierPriceForBuyer(calculation,sellingCurrency as never,fx);
  return{status:"VERIFIED_LIVE_FREIGHT",evidence:{supplierVariantId:variant.supplierVariantId,quantity:1,originCountry:variant.originCountryCodes[0],destinationCountry,freightMethod:freight.selected.name,freightAmount:freight.selected.amount,freightCurrency:freight.selected.currency,totalIncludedCost:calculation.totalIncludedCost,targetMargin:calculation.targetMargin,sellingCurrency,referenceSellingPrice:presentment.finalSellingPrice,fx:{provider:fx.provider,rate:fx.rate,effectiveAt:fx.effectiveAt},calculatedAt:new Date().toISOString(),source:"CJ_LIVE_FREIGHT_VERIFIED_FX"}};
}

function quarantineCode(code:string){return code.includes("PRICING")||code.startsWith("FX_")||code.includes("FREIGHT")||code.includes("ORIGIN_OR_COST")||code==="CJ_PRODUCT_NOT_FOUND"||code==="SUPPLIER_PRODUCT_INVALID"||code==="CJ_PRODUCT_INVALID";}

async function refreshJobCounts(db:PrismaClient,jobId:string){
  const groups=await db.supplierCatalogImportItem.groupBy({by:["status"],where:{jobId},_count:{_all:true}}),counts=new Map(groups.map((group)=>[group.status,group._count._all]));
  const pending=(counts.get("PENDING")??0)+(counts.get("IMPORTING")??0),failed=counts.get("FAILED")??0,quarantined=counts.get("QUARANTINED")??0;
  return db.supplierCatalogImportJob.update({where:{id:jobId},data:{processedCount:{set:[...counts].filter(([status])=>status!=="PENDING"&&status!=="IMPORTING").reduce((sum,[,count])=>sum+count,0)},importedCount:{set:counts.get("IMPORTED")??0},skippedCount:{set:counts.get("SKIPPED")??0},quarantinedCount:{set:quarantined},failedCount:{set:failed},status:pending?"RUNNING":failed||quarantined?"COMPLETED_WITH_ERRORS":"COMPLETED",completedAt:pending?null:new Date()},select:{id:true,status:true,requestedCount:true,processedCount:true,importedCount:true,skippedCount:true,quarantinedCount:true,failedCount:true,batchLimit:true,destinationCountry:true,updatedAt:true,completedAt:true}});
}

export async function processCatalogImportJob(db:PrismaClient,provider:SupplierCatalogProvider,jobId:string,input:{adminId:string;limit?:unknown}){
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:jobId,createdById:input.adminId},select:{id:true,storeId:true,destinationCountry:true,batchLimit:true,store:{select:{currency:true}}}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");
  if(!provider.isConfigured())throw new Error("SUPPLIER_NOT_CONFIGURED");
  await db.supplierCatalogImportItem.updateMany({where:{jobId,status:"IMPORTING",claimedAt:{lt:new Date(Date.now()-STALE_CLAIM_MS)}},data:{status:"PENDING",claimedAt:null,errorCode:"INTERRUPTED_ITEM_RESUMED",errorMessage:null}});
  await db.supplierCatalogImportJob.update({where:{id:jobId},data:{status:"RUNNING",startedAt:new Date(),completedAt:null}});
  const limit=boundedInteger(input.limit,job.batchLimit,MAX_CATALOG_PROCESS_LIMIT),media=defaultSupplierMediaProvider();
  for(let processed=0;processed<limit;processed+=1){
    const candidate=await db.supplierCatalogImportItem.findFirst({where:{jobId,status:"PENDING"},orderBy:{position:"asc"},select:{id:true,requestedIdentifier:true,canonicalCategoryId:true}});if(!candidate)break;
    const claim=await db.supplierCatalogImportItem.updateMany({where:{id:candidate.id,status:"PENDING"},data:{status:"IMPORTING",claimedAt:new Date(),attemptCount:{increment:1},errorCode:null,errorMessage:null}});if(claim.count!==1){processed-=1;continue;}
    try{
      const snapshot=await provider.getProduct(candidate.requestedIdentifier),category=resolveCatalogCategory(snapshot,candidate.canonicalCategoryId),compliance=catalogComplianceDecision(snapshot);
      const common={canonicalSupplierId:snapshot.supplierProductId,supplierSku:snapshot.sku,canonicalCategoryId:category.categoryId,categoryMappingSource:category.source,categoryMappingReason:category.reason,stockStatus:snapshot.available&&snapshot.stock>0?"AVAILABLE":"UNAVAILABLE",complianceStatus:compliance.status,complianceReason:compliance.reason};
      if(!category.categoryId||compliance.status==="QUARANTINED"){await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"QUARANTINED",errorCode:!category.categoryId?"CANONICAL_CATEGORY_REVIEW_REQUIRED":compliance.reason,completedAt:new Date()}});continue;}
      let pricing:Awaited<ReturnType<typeof verifiedCatalogPricing>>;try{pricing=await verifiedCatalogPricing(provider,snapshot,job.destinationCountry,job.store.currency);}catch(error){const code=publicCatalogError(error);await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"QUARANTINED",pricingStatus:"UNAVAILABLE",errorCode:code,errorMessage:code,completedAt:new Date()}});continue;}
      const existing=await db.supplierProductLink.findUnique({where:{connectionId_supplierProductId:{connectionId:PLATFORM_CJ_CONNECTION_ID,supplierProductId:snapshot.supplierProductId}},select:{productId:true}});
      if(existing){await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"SKIPPED",pricingStatus:pricing.status,pricingEvidence:pricing.evidence as Prisma.InputJsonValue,productId:existing.productId,errorCode:"SUPPLIER_PRODUCT_ALREADY_IMPORTED",completedAt:new Date()}});continue;}
      const product=await importSupplierProduct(db,provider,media,{storeId:job.storeId,connectionId:PLATFORM_CJ_CONNECTION_ID,ownerType:"PLATFORM",supplierProductId:snapshot.supplierProductId,sellingPrice:null,sellingCurrency:job.store.currency,category:category.categoryId});
      await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"IMPORTED",pricingStatus:pricing.status,pricingEvidence:pricing.evidence as Prisma.InputJsonValue,productId:product.id,completedAt:new Date()}});
    }catch(error){const code=publicCatalogError(error),status=code==="SUPPLIER_PRODUCT_ALREADY_IMPORTED"?"SKIPPED":quarantineCode(code)?"QUARANTINED":"FAILED";await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{status,errorCode:code,errorMessage:code,completedAt:new Date()}});}
  }
  return refreshJobCounts(db,jobId);
}

export async function retryCatalogImportItems(db:PrismaClient,input:{adminId:string;jobId:string;itemIds?:unknown;canonicalCategoryId?:unknown}){
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:input.jobId,createdById:input.adminId},select:{id:true}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");
  const itemIds=Array.isArray(input.itemIds)?[...new Set(input.itemIds.map(String).filter((id)=>id.length>=4&&id.length<=100))]:[];
  const category=typeof input.canonicalCategoryId==="string"?resolveCatalogCategory({categoryReference:null,title:""},input.canonicalCategoryId):null;if(category&&!category.categoryId)throw new Error("CANONICAL_CATEGORY_INVALID");
  const updated=await db.supplierCatalogImportItem.updateMany({where:{jobId:job.id,status:{in:["FAILED","QUARANTINED"]},...(itemIds.length?{id:{in:itemIds}}:{})},data:{status:"PENDING",claimedAt:null,completedAt:null,errorCode:null,errorMessage:null,...(category?.categoryId?{canonicalCategoryId:category.categoryId,categoryMappingSource:"ADMIN",categoryMappingReason:category.reason}:{})}});
  await db.supplierCatalogImportJob.update({where:{id:job.id},data:{status:"PENDING",completedAt:null}});return{updated:updated.count};
}

export async function readCatalogImportJob(db:PrismaClient,input:{adminId:string;jobId:string;cursor?:unknown;take?:unknown}){
  const take=boundedInteger(input.take,50,100),cursor=typeof input.cursor==="string"&&input.cursor?input.cursor:undefined;
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:input.jobId,createdById:input.adminId},select:{id:true,status:true,requestedCount:true,processedCount:true,importedCount:true,skippedCount:true,quarantinedCount:true,failedCount:true,batchLimit:true,destinationCountry:true,createdAt:true,updatedAt:true,completedAt:true,items:{orderBy:{position:"asc"},take,cursor:cursor?{id:cursor}:undefined,skip:cursor?1:0,select:{id:true,position:true,requestedIdentifier:true,canonicalSupplierId:true,supplierSku:true,status:true,canonicalCategoryId:true,categoryMappingSource:true,categoryMappingReason:true,pricingStatus:true,stockStatus:true,complianceStatus:true,complianceReason:true,errorCode:true,productId:true,attemptCount:true,updatedAt:true}}}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");return{...job,nextCursor:job.items.length===take?job.items.at(-1)?.id:null};
}
