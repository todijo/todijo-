import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { verifiedFxRate } from "../fx";
import { normalizeCountryCode } from "../shipping";
import { PLATFORM_CJ_CONNECTION_ID } from "./supplier-access";
import { calculateSupplierVariantPriceWithFreight, convertSupplierPriceForBuyer } from "./pricing";
import { defaultSupplierMediaProvider, importSupplierProduct } from "./supplier-products";
import { catalogComplianceDecision, publicCatalogError, resolveCatalogCategory } from "./supplier-catalog-policy";
import type { SupplierCatalogProvider, SupplierProductSnapshot } from "./types";
import { classifyCjProductByTaxonomyId } from "./cj-taxonomy-classifier";
import { resolveCjFreightAcrossOrigins } from "./cj-origin-freight";

export const MAX_CATALOG_JOB_ITEMS=500;
export const DEFAULT_CATALOG_PROCESS_LIMIT=10;
export const MAX_CATALOG_PROCESS_LIMIT=25;
export const CATALOG_IMPORT_CONCURRENCY=4;
const STALE_CLAIM_MS=15*60_000;

type JobCategoryInput = {adminId:string;storeId:string;identifiers:unknown;destinationCountry:unknown;canonicalCategoryId?:string|null;batchLimit?:unknown;canonicalCategoryByIdentifier?:Record<string,string>};

function boundedInteger(value:unknown,fallback:number,maximum:number){const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,maximum):fallback;}
async function mapWorkBounded<T,R>(items:readonly T[],worker:(item:T)=>Promise<R>,concurrency:number,maximum:number){const ceiling=Math.max(1,Math.min(maximum,Math.floor(concurrency)||1)),cursor={value:0},results=new Array<R>(items.length);async function run(){for(;;){const index=cursor.value++;if(index>=items.length)return;results[index]=await worker(items[index]);}}await Promise.all(Array.from({length:Math.min(ceiling,items.length)},()=>run()));return results;}
export async function runCatalogWorkBounded<T>(items:readonly T[],worker:(item:T)=>Promise<void>,concurrency=CATALOG_IMPORT_CONCURRENCY){await mapWorkBounded(items,worker,concurrency,CATALOG_IMPORT_CONCURRENCY);}
type ImportTiming={productDetailMs:number;normalizationMs:number;databaseMs:number;freightPricingMs:number;mediaImportMs:number;totalMs:number};
function elapsed(start:number){return Math.max(0,Math.round(performance.now()-start));}
export function catalogIdentifiers(value:unknown){const values=(Array.isArray(value)?value:typeof value==="string"?value.split(/[\s,;]+/):[]).map((item)=>String(item).trim()).filter(Boolean);if(values.some((item)=>!/^[A-Za-z0-9-]{4,200}$/.test(item)))throw new Error("SUPPLIER_BULK_INPUT_INVALID");return[...new Set(values)];}

function parseCanonicalCategoryByIdentifier(input:unknown,identifiers:string[]){
  if(input==null||typeof input!=="object"||Array.isArray(input))return new Map<string,string>();
  const requested=new Set(identifiers),map=new Map<string,string>();
  for(const [identifier,rawCategory] of Object.entries(input)){
    const normalized=String(identifier).trim();
    if(!requested.has(normalized)||typeof rawCategory!=="string")continue;
    const category=rawCategory.trim();
    if(!category)continue;
    map.set(normalized,category);
  }
  return map;
}

export async function createCatalogImportJob(db:PrismaClient,input:JobCategoryInput){
  const identifiers=catalogIdentifiers(input.identifiers),destinationCountry=normalizeCountryCode(input.destinationCountry),batchLimit=boundedInteger(input.batchLimit,DEFAULT_CATALOG_PROCESS_LIMIT,MAX_CATALOG_PROCESS_LIMIT);
  if(!identifiers.length||identifiers.length>MAX_CATALOG_JOB_ITEMS)throw new Error(identifiers.length>MAX_CATALOG_JOB_ITEMS?"SUPPLIER_BULK_LIMIT_EXCEEDED":"SUPPLIER_BULK_INPUT_INVALID");
  const globalCategory=resolveCatalogCategory({categoryReference:null,title:""},input.canonicalCategoryId);
  if(input.canonicalCategoryId&&!globalCategory.categoryId)throw new Error("CANONICAL_CATEGORY_INVALID");
  const overrides=parseCanonicalCategoryByIdentifier(input.canonicalCategoryByIdentifier,identifiers);
  for(const categoryId of overrides.values()){
    if(!resolveCatalogCategory({categoryReference:null,title:""},categoryId).categoryId)throw new Error("CANONICAL_CATEGORY_INVALID");
  }
  return db.supplierCatalogImportJob.create({data:{createdById:input.adminId,storeId:input.storeId,destinationCountry,requestedCount:identifiers.length,batchLimit,items:{create:identifiers.map((requestedIdentifier,position)=>{
    const hasOverride=overrides.has(requestedIdentifier);
    const category=resolveCatalogCategory({categoryReference:null,title:""},hasOverride?overrides.get(requestedIdentifier):input.canonicalCategoryId);
    return{
      requestedIdentifier,position,canonicalCategoryId:category.categoryId,
      categoryMappingSource:category.categoryId?category.source:null,
      categoryMappingReason:category.categoryId?category.reason:null,
    };
  })}},select:jobSummarySelect});
}

const jobSummarySelect={id:true,status:true,requestedCount:true,processedCount:true,importedCount:true,skippedCount:true,quarantinedCount:true,failedCount:true,batchLimit:true,destinationCountry:true,createdAt:true,startedAt:true,updatedAt:true,completedAt:true} as const;

export async function listCatalogImportJobs(db:PrismaClient,adminId:string){
  const jobs=await db.supplierCatalogImportJob.findMany({where:{createdById:adminId},orderBy:{createdAt:"desc"},take:20,select:jobSummarySelect});
  if(!jobs.length)return[];
  const active=await db.supplierCatalogImportItem.groupBy({by:["jobId"],where:{jobId:{in:jobs.map(job=>job.id)},status:"IMPORTING"},_count:{_all:true}}),counts=new Map(active.map(row=>[row.jobId,row._count._all]));
  return jobs.map(job=>{const processingCount=counts.get(job.id)??0,remainingCount=Math.max(0,job.requestedCount-job.processedCount);return{...job,processingCount,remainingCount,isProcessing:processingCount>0,canContinue:processingCount===0&&remainingCount>0&&(job.status==="PENDING"||job.status==="RUNNING")};});
}

type CatalogPricingAttempt={supplierVariantId:string;origins:string[];status:"SELECTED"|"REJECTED";errorCode?:string;selectedOrigin?:string;freightAmount?:string;freightCurrency?:string;buyerPrice?:string};
type CatalogPricingEvidence={variantsExamined:number;eligibleVariants:number;attempts:CatalogPricingAttempt[];terminalErrorCode?:string};
export class CatalogPricingResolutionError extends Error{constructor(public readonly code:string,public readonly evidence:CatalogPricingEvidence){super(code);}}
function safePricingCode(error:unknown){const value=error instanceof Error?error.message:"SUPPLIER_IMPORT_FAILED";return /^[A-Z][A-Z0-9_]{2,80}$/.test(value)?value:"SUPPLIER_IMPORT_FAILED";}
function validPurchasableVariant(candidate:SupplierProductSnapshot["variants"][number]){try{return candidate.available&&candidate.stock>0&&/^[A-Za-z0-9-]{4,200}$/.test(candidate.supplierVariantId)&&candidate.cost!=null&&new Prisma.Decimal(candidate.cost).isFinite()&&new Prisma.Decimal(candidate.cost).greaterThan(0)&&candidate.originCountryCodes.some(code=>/^[A-Z]{2}$/.test(code.trim().toUpperCase()));}catch{return false;}}

export async function verifiedCatalogPricing(provider:SupplierCatalogProvider,snapshot:SupplierProductSnapshot,destinationCountry:string,sellingCurrency:string,dependencies:{fx?:typeof verifiedFxRate}={}){
  if(!provider.calculateFreight)throw new Error("CJ_FREIGHT_UNAVAILABLE");
  const variants=snapshot.variants.filter(validPurchasableVariant);
  if(!variants.length)throw new CatalogPricingResolutionError("DROPSHIPPING_NO_PURCHASABLE_VARIANT",{variantsExamined:snapshot.variants.length,eligibleVariants:0,attempts:[],terminalErrorCode:"DROPSHIPPING_NO_PURCHASABLE_VARIANT"});
  let best:null|{variant:typeof variants[number];freight:Awaited<ReturnType<typeof resolveCjFreightAcrossOrigins>>;calculation:ReturnType<typeof calculateSupplierVariantPriceWithFreight>;presentment:ReturnType<typeof convertSupplierPriceForBuyer>;fx:Awaited<ReturnType<typeof verifiedFxRate>>}=null;
  const attempts:CatalogPricingAttempt[]=[],freightProvider={calculateFreight:provider.calculateFreight.bind(provider)},fxProvider=dependencies.fx??verifiedFxRate,fxCache=new Map<string,ReturnType<typeof verifiedFxRate>>();
  function resolveFx(baseCurrency:string,quoteCurrency:string){const key=`${baseCurrency.trim().toUpperCase()}->${quoteCurrency.trim().toUpperCase()}`;let pending=fxCache.get(key);if(!pending){pending=fxProvider(baseCurrency,quoteCurrency);fxCache.set(key,pending);}return pending;}
  for(const variant of variants){
    const origins=[...new Set(variant.originCountryCodes.map(code=>code.trim().toUpperCase()).filter(code=>/^[A-Z]{2}$/.test(code)))].sort();
    try{
      const freight=await resolveCjFreightAcrossOrigins(freightProvider,{originCountryCodes:origins,destinationCountry,variantId:variant.supplierVariantId,quantity:1});
      const calculation=calculateSupplierVariantPriceWithFreight(snapshot,variant.supplierVariantId,{amount:freight.selected.amount,currency:freight.selected.currency});
      const fx=await resolveFx(calculation.sellingCurrency,sellingCurrency),presentment=convertSupplierPriceForBuyer(calculation,sellingCurrency as never,fx);
      attempts.push({supplierVariantId:variant.supplierVariantId,origins,status:"SELECTED",selectedOrigin:freight.selected.originCountry,freightAmount:freight.selected.amount,freightCurrency:freight.selected.currency,buyerPrice:presentment.finalSellingPrice});
      best={variant,freight,calculation,presentment,fx};
      break;
    }catch(error){attempts.push({supplierVariantId:variant.supplierVariantId,origins,status:"REJECTED",errorCode:safePricingCode(error)});}
  }
  if(!best){const codes=attempts.map(item=>item.errorCode),terminal=codes.includes("CJ_FREIGHT_RESPONSE_INVALID")?"CJ_FREIGHT_RESPONSE_INVALID":codes.includes("CJ_FREIGHT_TEMPORARY_FAILURE")?"CJ_FREIGHT_TEMPORARY_FAILURE":codes.every(code=>code==="CJ_FREIGHT_NO_METHODS")?"CJ_FREIGHT_NO_METHODS":"CJ_CATALOG_PRICING_UNAVAILABLE";throw new CatalogPricingResolutionError(terminal,{variantsExamined:snapshot.variants.length,eligibleVariants:variants.length,attempts,terminalErrorCode:terminal});}
  return{status:"VERIFIED_LIVE_FREIGHT",evidence:{variantsExamined:snapshot.variants.length,eligibleVariants:variants.length,variantsProbed:attempts.length,referenceStrategy:"FIRST_PURCHASABLE_VARIANT_WITH_FREIGHT",attempts,supplierVariantId:best.variant.supplierVariantId,quantity:1,originCountry:best.freight.selected.originCountry,destinationCountry,freightMethod:best.freight.selected.name,freightAmount:best.freight.selected.amount,freightCurrency:best.freight.selected.currency,totalIncludedCost:best.calculation.totalIncludedCost,targetMargin:best.calculation.targetMargin,sellingCurrency,referenceSellingPrice:best.presentment.finalSellingPrice,fx:{provider:best.fx.provider,rate:best.fx.rate,effectiveAt:best.fx.effectiveAt},calculatedAt:new Date().toISOString(),source:"CJ_LIVE_FREIGHT_VERIFIED_FX"}};
}

function quarantineCode(code:string){return code.includes("PRICING")||code.startsWith("FX_")||code.includes("FREIGHT")||code.includes("ORIGIN_OR_COST")||code.includes("PURCHASABLE_VARIANT")||code==="CJ_PRODUCT_NOT_FOUND"||code==="SUPPLIER_PRODUCT_INVALID"||code==="CJ_PRODUCT_INVALID";}

async function refreshJobCounts(db:PrismaClient,jobId:string){
  const groups=await db.supplierCatalogImportItem.groupBy({by:["status"],where:{jobId},_count:{_all:true}}),counts=new Map(groups.map((group)=>[group.status,group._count._all]));
  const pending=(counts.get("PENDING")??0)+(counts.get("IMPORTING")??0),failed=counts.get("FAILED")??0,quarantined=counts.get("QUARANTINED")??0;
  return db.supplierCatalogImportJob.update({where:{id:jobId},data:{processedCount:{set:[...counts].filter(([status])=>status!=="PENDING"&&status!=="IMPORTING").reduce((sum,[,count])=>sum+count,0)},importedCount:{set:counts.get("IMPORTED")??0},skippedCount:{set:counts.get("SKIPPED")??0},quarantinedCount:{set:quarantined},failedCount:{set:failed},status:pending?"PENDING":failed||quarantined?"COMPLETED_WITH_ERRORS":"COMPLETED",completedAt:pending?null:new Date()},select:jobSummarySelect});
}

export async function processCatalogImportJob(db:PrismaClient,provider:SupplierCatalogProvider,jobId:string,input:{adminId:string;limit?:unknown},dependencies:{media?:ReturnType<typeof defaultSupplierMediaProvider>;importer?:typeof importSupplierProduct;timing?:((event:{jobId:string;itemId?:string;supplierProductId?:string;timing:ImportTiming|{totalMs:number;processed:number}})=>void)}={}){
  const jobStarted=performance.now();
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:jobId,createdById:input.adminId},select:{id:true,storeId:true,status:true,destinationCountry:true,batchLimit:true,startedAt:true,updatedAt:true,store:{select:{currency:true}}}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");
  if(!provider.isConfigured())throw new Error("SUPPLIER_NOT_CONFIGURED");
  await db.supplierCatalogImportItem.updateMany({where:{jobId,status:"IMPORTING",claimedAt:{lt:new Date(Date.now()-STALE_CLAIM_MS)}},data:{status:"PENDING",claimedAt:null,errorCode:"INTERRUPTED_ITEM_RESUMED",errorMessage:null}});
  const activeClaims=await db.supplierCatalogImportItem.count({where:{jobId,status:"IMPORTING"}});if(activeClaims>0)throw new Error("SUPPLIER_CATALOG_JOB_BUSY");
  const claimTime=new Date(),claimed=await db.supplierCatalogImportJob.updateMany({where:{id:jobId,updatedAt:job.updatedAt,status:{in:["PENDING","RUNNING"]}},data:{status:"RUNNING",startedAt:job.startedAt??claimTime,updatedAt:claimTime,completedAt:null}});if(claimed.count!==1)throw new Error("SUPPLIER_CATALOG_JOB_BUSY");
  const limit=boundedInteger(input.limit,job.batchLimit,MAX_CATALOG_PROCESS_LIMIT),media=dependencies.media??defaultSupplierMediaProvider(),importer=dependencies.importer??importSupplierProduct;
  const candidates=await db.supplierCatalogImportItem.findMany({where:{jobId,status:"PENDING"},orderBy:{position:"asc"},take:limit,select:{id:true,requestedIdentifier:true,canonicalCategoryId:true}});
  await runCatalogWorkBounded(candidates,async candidate=>{
    const started=performance.now(),timing:ImportTiming={productDetailMs:0,normalizationMs:0,databaseMs:0,freightPricingMs:0,mediaImportMs:0,totalMs:0};
    const claim=await db.supplierCatalogImportItem.updateMany({where:{id:candidate.id,status:"PENDING"},data:{status:"IMPORTING",claimedAt:new Date(),attemptCount:{increment:1},errorCode:null,errorMessage:null}});if(claim.count!==1)return;
    let canonicalSupplierId:string|undefined;
    try{
      let stage=performance.now();const snapshot=await provider.getProduct(candidate.requestedIdentifier);canonicalSupplierId=snapshot.supplierProductId;timing.productDetailMs=elapsed(stage);
      stage=performance.now();const classification=await classifyCjProductByTaxonomyId(snapshot),automaticCategory=classification.status==="SUGGESTED"?classification.canonicalCategoryId:null,category=resolveCatalogCategory(snapshot,candidate.canonicalCategoryId??automaticCategory),compliance=catalogComplianceDecision(snapshot);timing.normalizationMs=elapsed(stage);
      const taxonomyMapped=classification.evidence.some((entry)=>entry.startsWith("CJ_TAXONOMY_ID_MAPPING:")||entry.startsWith("CJ_TAXONOMY_MAPPING:"));
      const common={canonicalSupplierId:snapshot.supplierProductId,supplierSku:snapshot.sku,canonicalCategoryId:category.categoryId,categoryMappingSource:candidate.canonicalCategoryId?"ADMIN":automaticCategory?(taxonomyMapped?"CJ_TAXONOMY":"CLASSIFIER"):category.source,categoryMappingReason:candidate.canonicalCategoryId?"ADMIN_SELECTED_CANONICAL_LEAF":automaticCategory?(taxonomyMapped?"CJ_CATEGORY_ID_AUTHORITATIVE_MAPPING":"CLASSIFIER_ACCEPTED_THRESHOLD"):category.reason,classificationStatus:candidate.canonicalCategoryId?"ADMIN_REVIEWED":classification.status,classificationConfidence:classification.confidence,classificationEvidence:classification.evidence as Prisma.InputJsonValue,stockStatus:snapshot.available&&snapshot.stock>0?"AVAILABLE":"UNAVAILABLE",complianceStatus:compliance.status,complianceReason:compliance.reason};
      stage=performance.now();const existing=await db.supplierProductLink.findUnique({where:{connectionId_supplierProductId:{connectionId:PLATFORM_CJ_CONNECTION_ID,supplierProductId:snapshot.supplierProductId}},select:{productId:true}});timing.databaseMs+=elapsed(stage);
      if(existing){stage=performance.now();await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"SKIPPED",pricingStatus:"NOT_REQUIRED_EXISTING_PRODUCT",productId:existing.productId,errorCode:"SUPPLIER_PRODUCT_ALREADY_IMPORTED",completedAt:new Date()}});timing.databaseMs+=elapsed(stage);return;}
      if(!category.categoryId||compliance.status==="QUARANTINED"){stage=performance.now();await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"QUARANTINED",errorCode:!category.categoryId?"CJ_CLASSIFICATION_REVIEW_REQUIRED":compliance.reason,completedAt:new Date()}});timing.databaseMs+=elapsed(stage);return;}
      let pricing:Awaited<ReturnType<typeof verifiedCatalogPricing>>;stage=performance.now();try{pricing=await verifiedCatalogPricing(provider,snapshot,job.destinationCountry,job.store.currency);timing.freightPricingMs=elapsed(stage);}catch(error){timing.freightPricingMs=elapsed(stage);const code=publicCatalogError(error),evidence=error instanceof CatalogPricingResolutionError?error.evidence:null;console.warn("[cj-catalog-pricing]",JSON.stringify({event:"catalog_pricing_unavailable",jobId,itemId:candidate.id,supplierProductId:snapshot.supplierProductId,variantsExamined:evidence?.variantsExamined??snapshot.variants.length,eligibleVariants:evidence?.eligibleVariants??null,terminalErrorCode:code}));stage=performance.now();await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"QUARANTINED",pricingStatus:"UNAVAILABLE",pricingEvidence:evidence?evidence as Prisma.InputJsonValue:Prisma.DbNull,errorCode:code,errorMessage:code,completedAt:new Date()}});timing.databaseMs+=elapsed(stage);return;}
      stage=performance.now();const product=await importer(db,provider,media,{storeId:job.storeId,connectionId:PLATFORM_CJ_CONNECTION_ID,ownerType:"PLATFORM",supplierProductId:snapshot.supplierProductId,sellingPrice:null,sellingCurrency:job.store.currency,category:category.categoryId,snapshot,classification,syncReviews:false});timing.mediaImportMs=elapsed(stage);
      stage=performance.now();await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{...common,status:"IMPORTED",pricingStatus:pricing.status,pricingEvidence:pricing.evidence as Prisma.InputJsonValue,productId:product.id,completedAt:new Date()}});timing.databaseMs+=elapsed(stage);
    }catch(error){const raced=error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"&&canonicalSupplierId?await db.supplierProductLink.findUnique({where:{connectionId_supplierProductId:{connectionId:PLATFORM_CJ_CONNECTION_ID,supplierProductId:canonicalSupplierId}},select:{productId:true}}):null,code=raced?"SUPPLIER_PRODUCT_ALREADY_IMPORTED":publicCatalogError(error),status=code==="SUPPLIER_PRODUCT_ALREADY_IMPORTED"?"SKIPPED":quarantineCode(code)?"QUARANTINED":"FAILED";await db.supplierCatalogImportItem.update({where:{id:candidate.id},data:{status,canonicalSupplierId,errorCode:code,errorMessage:code,productId:raced?.productId,completedAt:new Date()}});}
    finally{timing.totalMs=elapsed(started);const event={jobId,itemId:candidate.id,supplierProductId:candidate.requestedIdentifier,timing};dependencies.timing?.(event);console.info("[cj-catalog-import]",JSON.stringify({event:"item_timing",...event}));}
  });
  const result=await refreshJobCounts(db,jobId),jobTiming={totalMs:elapsed(jobStarted),processed:candidates.length};dependencies.timing?.({jobId,timing:jobTiming});console.info("[cj-catalog-import]",JSON.stringify({event:"job_timing",jobId,timing:jobTiming}));return result;
}

export async function retryCatalogImportItems(db:PrismaClient,input:{adminId:string;jobId:string;itemIds?:unknown;canonicalCategoryId?:unknown}){
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:input.jobId,createdById:input.adminId},select:{id:true}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");
  const itemIds=Array.isArray(input.itemIds)?[...new Set(input.itemIds.map(String).filter((id)=>id.length>=4&&id.length<=100))]:[];
  const category=typeof input.canonicalCategoryId==="string"?resolveCatalogCategory({categoryReference:null,title:""},input.canonicalCategoryId):null;if(category&&!category.categoryId)throw new Error("CANONICAL_CATEGORY_INVALID");
  const updated=await db.supplierCatalogImportItem.updateMany({where:{jobId:job.id,status:{in:["FAILED","QUARANTINED"]},...(itemIds.length?{id:{in:itemIds}}:{})},data:{status:"PENDING",claimedAt:null,completedAt:null,errorCode:null,errorMessage:null,pricingStatus:null,pricingEvidence:Prisma.DbNull,...(category?.categoryId?{canonicalCategoryId:category.categoryId,categoryMappingSource:"ADMIN",categoryMappingReason:category.reason}:{})}});
  await db.supplierCatalogImportJob.update({where:{id:job.id},data:{status:"PENDING",completedAt:null}});return{updated:updated.count};
}

export async function readCatalogImportJob(db:PrismaClient,input:{adminId:string;jobId:string;cursor?:unknown;take?:unknown}){
  const take=boundedInteger(input.take,50,100),cursor=typeof input.cursor==="string"&&input.cursor?input.cursor:undefined;
  const job=await db.supplierCatalogImportJob.findFirst({where:{id:input.jobId,createdById:input.adminId},select:{...jobSummarySelect,items:{orderBy:{position:"asc"},take,cursor:cursor?{id:cursor}:undefined,skip:cursor?1:0,select:{id:true,position:true,requestedIdentifier:true,canonicalSupplierId:true,supplierSku:true,status:true,canonicalCategoryId:true,categoryMappingSource:true,categoryMappingReason:true,classificationStatus:true,classificationConfidence:true,classificationEvidence:true,pricingStatus:true,stockStatus:true,complianceStatus:true,complianceReason:true,errorCode:true,productId:true,attemptCount:true,updatedAt:true}}}});if(!job)throw new Error("SUPPLIER_CATALOG_JOB_NOT_FOUND");const processingCount=await db.supplierCatalogImportItem.count({where:{jobId:job.id,status:"IMPORTING"}}),remainingCount=Math.max(0,job.requestedCount-job.processedCount);return{...job,processingCount,remainingCount,isProcessing:processingCount>0,canContinue:processingCount===0&&remainingCount>0&&(job.status==="PENDING"||job.status==="RUNNING"),nextCursor:job.items.length===take?job.items.at(-1)?.id:null};
}
