import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Prisma} from "@prisma/client";
import {MARKETPLACE_CANONICAL_LEAF_CATEGORIES} from "../lib/marketplace-category-registry";
import {CATALOG_FREIGHT_CONCURRENCY,CatalogPricingResolutionError,processCatalogImportJob,retryCatalogImportItems,verifiedCatalogPricing} from "../lib/suppliers/supplier-catalog-jobs";
import type {CjFreightQuote} from "../lib/suppliers/cj-freight";
import {calculateSupplierSnapshotPrices} from "../lib/suppliers/pricing";
import type {SupplierCatalogProvider,SupplierProductSnapshot,SupplierVariantSnapshot} from "../lib/suppliers/types";

function variant(id:string,cost:number|null,origins:string[],available=true):SupplierVariantSnapshot{return{supplierVariantId:id,sku:id,title:id,cost,currency:"USD",stock:available?5:0,available,originCountryCodes:origins};}
function snapshot(variants:SupplierVariantSnapshot[]):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:"CJ-PRODUCT-ROOT",sku:"CJ-SKU",title:"Plain cotton product",description:"Unbranded everyday product",categoryReference:null,sourceUrl:null,cost:5,currency:"USD",stock:variants.reduce((sum,item)=>sum+item.stock,0),available:variants.some(item=>item.available),weightGrams:100,variants,media:[{type:"IMAGE",url:"https://example.test/product.jpg"}],rawMetadata:{}};}
function quote(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number},amount:string):CjFreightQuote{const selected={id:`method-${input.originCountry}`,name:`${input.originCountry} delivery`,amount,currency:"USD" as const,estimatedDelivery:"7-12 days",originCountry:input.originCountry,destinationCountry:input.destinationCountry};return{selected,methods:[selected],variantId:input.variantId,quantity:input.quantity,calculatedAt:new Date().toISOString(),cached:false};}
function provider(product:SupplierProductSnapshot,freight:(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string})=>Promise<CjFreightQuote>):SupplierCatalogProvider{return{id:"CJ",isConfigured:()=>true,getProduct:async()=>product,calculateFreight:freight};}
const identityFx=async()=>({provider:"IDENTITY" as const,baseCurrency:"USD" as const,quoteCurrency:"USD" as const,rate:"1",fetchedAt:new Date().toISOString(),effectiveAt:new Date().toISOString()});

test("catalog pricing skips an invalid first variant and imports from the next purchasable variant",async()=>{
 const product=snapshot([variant("CJ-INVALID",null,["CN"]),variant("CJ-VALID",8,["CN"])]),result=await verifiedCatalogPricing(provider(product,async input=>quote(input,"4")),product,"FR","USD",{fx:identityFx});
 assert.equal(result.evidence.supplierVariantId,"CJ-VALID");assert.equal(Number(result.evidence.referenceSellingPrice),15);assert.equal(result.evidence.targetMargin,"0.2");
 const persisted=calculateSupplierSnapshotPrices(product,"USD");assert.deepEqual(persisted.variants.map(item=>item.supplierVariantId),["CJ-VALID"]);assert.equal(persisted.basePrice,"10.00");
});

test("catalog pricing tolerates one failed origin and chooses another valid origin",async()=>{
 const calls:string[]=[],product=snapshot([variant("CJ-VARIANT",8,["US","CN","US"])]),result=await verifiedCatalogPricing(provider(product,async input=>{calls.push(input.originCountry);if(input.originCountry==="CN")throw new Error("CJ_FREIGHT_NO_METHODS");return quote(input,"5");}),product,"FR","USD",{fx:identityFx});
 assert.deepEqual(calls,["CN","US"]);assert.equal(result.evidence.originCountry,"US");
});

test("catalog pricing chooses the cheapest valid origin and cheapest complete variant price deterministically",async()=>{
 const product=snapshot([variant("CJ-A",10,["CN","DE"]),variant("CJ-B",5,["CN"])]),result=await verifiedCatalogPricing(provider(product,async input=>quote(input,input.variantId==="CJ-A"?(input.originCountry==="CN"?"8":"2"):"5")),product,"FR","USD",{fx:identityFx});
 assert.equal(result.evidence.supplierVariantId,"CJ-B");assert.equal(result.evidence.originCountry,"CN");assert.equal(Number(result.evidence.referenceSellingPrice),12.5);assert.equal(result.evidence.attempts.length,2);
});

test("catalog pricing probes variants concurrently but remains bounded and deterministic",async()=>{
 const product=snapshot([variant("CJ-A",10,["CN"]),variant("CJ-B",9,["CN"]),variant("CJ-C",8,["CN"]),variant("CJ-D",7,["CN"])]);let active=0,peak=0;
 const result=await verifiedCatalogPricing(provider(product,async input=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,30));active--;return quote(input,String(input.variantId==="CJ-D"?1:5));}),product,"FR","USD",{fx:identityFx});
 assert.equal(CATALOG_FREIGHT_CONCURRENCY,2);assert.equal(peak,2);assert.equal(result.evidence.supplierVariantId,"CJ-D");assert.deepEqual(result.evidence.attempts.map(item=>item.supplierVariantId),["CJ-A","CJ-B","CJ-C","CJ-D"]);
});

test("catalog pricing fails closed with useful evidence when no variant or freight is usable",async()=>{
 const noVariant=snapshot([variant("CJ-NO-COST",null,["CN"]),variant("CJ-OFF",5,["CN"],false)]);
 await assert.rejects(()=>verifiedCatalogPricing(provider(noVariant,async input=>quote(input,"1")),noVariant,"FR","USD",{fx:identityFx}),(error:unknown)=>error instanceof CatalogPricingResolutionError&&error.code==="DROPSHIPPING_NO_PURCHASABLE_VARIANT"&&error.evidence.variantsExamined===2);
 const noFreight=snapshot([variant("CJ-NO-FREIGHT",5,["CN","US"])]);
 await assert.rejects(()=>verifiedCatalogPricing(provider(noFreight,async()=>{throw new Error("CJ_FREIGHT_NO_METHODS");}),noFreight,"FR","USD",{fx:identityFx}),(error:unknown)=>error instanceof CatalogPricingResolutionError&&error.code==="CJ_FREIGHT_NO_METHODS"&&error.evidence.attempts[0].origins.join(",")==="CN,US");
});

test("malformed freight is rejected and verified FX preserves the twenty percent formula",async()=>{
 const product=snapshot([variant("CJ-FX",8,["CN"])]),bad=provider(product,async input=>({...quote(input,"4"),selected:{...quote(input,"4").selected,originCountry:""}}));
 await assert.rejects(()=>verifiedCatalogPricing(bad,product,"FR","USD",{fx:identityFx}),(error:unknown)=>error instanceof CatalogPricingResolutionError&&error.code==="CJ_FREIGHT_RESPONSE_INVALID");
 const fx=async()=>({provider:"OPEN_EXCHANGE_RATES" as const,baseCurrency:"USD" as const,quoteCurrency:"EUR" as const,rate:"0.5",fetchedAt:new Date().toISOString(),effectiveAt:new Date().toISOString()}),result=await verifiedCatalogPricing(provider(product,async input=>quote(input,"4")),product,"FR","EUR",{fx});
 assert.equal(result.evidence.totalIncludedCost,"12.00");assert.equal(Number(result.evidence.referenceSellingPrice),7.5);assert.equal(result.evidence.targetMargin,"0.2");
});

test("retry clears stale pricing evidence and the same quarantined item can become imported",async()=>{
 const canonicalCategoryId=MARKETPLACE_CANONICAL_LEAF_CATEGORIES[0].id,product=snapshot([variant("CJ-RETRY",8,["CN"])]);let state="QUARANTINED",pricingStatus:string|null="UNAVAILABLE",pricingEvidence:unknown={terminalErrorCode:"CJ_FREIGHT_NO_METHODS"},imported=false;
 const db={supplierCatalogImportJob:{findFirst:async()=>({id:"job-1",storeId:"store-1",destinationCountry:"FR",batchLimit:1,store:{currency:"USD"}}),update:async({data}:{data:Record<string,unknown>})=>({id:"job-1",...data})},supplierCatalogImportItem:{updateMany:async({where,data}:{where:Record<string,unknown>;data:Record<string,unknown>})=>{if(Array.isArray((where.status as {in?:string[]})?.in)){state=String(data.status);pricingStatus=data.pricingStatus as null;pricingEvidence=data.pricingEvidence;return{count:1};}if(where.status==="IMPORTING")return{count:0};if(where.status==="PENDING"&&state==="PENDING"){state="IMPORTING";return{count:1};}return{count:0};},findMany:async()=>state==="PENDING"?[{id:"item-1",requestedIdentifier:"CJ-PRODUCT-ROOT",canonicalCategoryId}]:[],update:async({data}:{data:Record<string,unknown>})=>{state=String(data.status);pricingStatus=data.pricingStatus as string;pricingEvidence=data.pricingEvidence;return{};},groupBy:async()=>[{status:state,_count:{_all:1}}]},supplierProductLink:{findUnique:async()=>null}} as never;
 await retryCatalogImportItems(db,{adminId:"admin-1",jobId:"job-1"});assert.equal(state,"PENDING");assert.equal(pricingStatus,null);assert.equal(pricingEvidence,Prisma.DbNull);
 await processCatalogImportJob(db,provider(product,async input=>quote(input,"4")),"job-1",{adminId:"admin-1",limit:1},{media:{} as never,importer:async()=>{imported=true;return{id:"product-1"} as never;}});
 assert.equal(imported,true);assert.equal(state,"IMPORTED");assert.equal(pricingStatus,"VERIFIED_LIVE_FREIGHT");
});

test("existing products skip before pricing and buyer/catalog pricing share the same freight resolver",()=>{
 const jobs=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),buyer=readFileSync("lib/suppliers/commerce-pricing.ts","utf8"),checkout=readFileSync("lib/payments.ts","utf8"),pricing=readFileSync("lib/suppliers/pricing.ts","utf8"),retryRoute=readFileSync("app/api/admin/supplier-products/bulk-import/[jobId]/retry/route.ts","utf8");
 const execution=jobs.slice(jobs.indexOf("export async function processCatalogImportJob"));assert.ok(execution.indexOf("const existing=")<execution.indexOf("verifiedCatalogPricing(provider"));assert.match(jobs,/NOT_REQUIRED_EXISTING_PRODUCT/);assert.match(jobs,/resolveCjFreightAcrossOrigins/);assert.match(buyer,/resolveCjFreightAcrossOrigins/);assert.match(checkout,/resolveDropshippingPricing/);assert.match(pricing,/DEFAULT_SUPPLIER_TARGET_MARGIN/);
 assert.match(retryRoute,/retryCatalogImportItems/);assert.match(retryRoute,/processCatalogImportJob/);
});