import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { calculateSupplierPrice, calculateSupplierSnapshotPrices, DEFAULT_SUPPLIER_TARGET_MARGIN, SupplierPricingError } from "../lib/suppliers/pricing";
import { importSupplierProduct, syncSupplierProduct } from "../lib/suppliers/supplier-products";
import { resetFxCacheForTests } from "../lib/fx";

test("20 percent target margin divides total known cost by one minus margin",()=>{
  const result=calculateSupplierPrice({supplierCost:"8",supplierCurrency:"EUR",sellingCurrency:"EUR",shipping:{status:"KNOWN",amount:"4",currency:"EUR"}});
  assert.equal(DEFAULT_SUPPLIER_TARGET_MARGIN.toString(),"0.2");
  assert.equal(result.totalIncludedCost,"12.00");
  assert.equal(result.rawSellingPrice,"15");
  assert.equal(result.finalSellingPrice,"15.00");
  assert.equal(result.marginGuaranteed,true);
});

test("rounding always stays at or above the minimum target-margin price",()=>{
  const result=calculateSupplierPrice({supplierCost:"11.94",supplierCurrency:"EUR",sellingCurrency:"EUR",shipping:{status:"KNOWN",amount:"0",currency:"EUR"}});
  assert.equal(result.finalSellingPrice,"14.93");
  const price=new Prisma.Decimal(result.finalSellingPrice),cost=new Prisma.Decimal(result.totalIncludedCost);
  assert.equal(price.greaterThanOrEqualTo(result.rawSellingPrice),true);
  assert.equal(price.sub(cost).div(price).greaterThanOrEqualTo(DEFAULT_SUPPLIER_TARGET_MARGIN),true);
});

test("invalid costs, margins, and duplicate fee components fail closed",()=>{
  const base={supplierCost:"8",supplierCurrency:"EUR",sellingCurrency:"EUR",shipping:{status:"KNOWN",amount:"0",currency:"EUR"} as const};
  for(const supplierCost of ["", "0", "-1", "bad"])assert.throws(()=>calculateSupplierPrice({...base,supplierCost}),SupplierPricingError);
  for(const targetMargin of ["-0.01","1","1.1"])assert.throws(()=>calculateSupplierPrice({...base,targetMargin}),/PRICING_MARGIN_INVALID/);
  assert.throws(()=>calculateSupplierPrice({...base,fees:[{name:"service",amount:"1",currency:"EUR"},{name:"Service",amount:"1",currency:"EUR"}]}),/PRICING_COST_INVALID/);
});

test("unknown shipping is an explicit base estimate and never claims a guaranteed margin",()=>{
  const result=calculateSupplierPrice({supplierCost:"8",supplierCurrency:"EUR",sellingCurrency:"EUR",shipping:{status:"DEFERRED",required:true}});
  assert.equal(result.shippingCost,null);assert.equal(result.shippingStatus,"DEFERRED");assert.equal(result.marginGuaranteed,false);
});

test("USD cost is never treated as EUR without an explicit verified conversion",()=>{
  assert.throws(()=>calculateSupplierPrice({supplierCost:"8",supplierCurrency:"USD",sellingCurrency:"EUR",shipping:{status:"DEFERRED",required:true}}),/PRICING_CURRENCY_CONVERSION_REQUIRED/);
  const converted=calculateSupplierPrice({supplierCost:"8",supplierCurrency:"USD",sellingCurrency:"EUR",exchangeRate:"0.9",shipping:{status:"DEFERRED",required:true}});
  assert.equal(converted.supplierCost,"8.00");assert.equal(converted.convertedSupplierCost,"7.20");
});

test("variant-specific costs produce variant prices and the lowest safe base price",()=>{
  const snapshot:any={provider:"CJ",supplierProductId:"PID",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:"8",currency:"EUR",stock:2,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"S",sku:null,title:"S",cost:"8",currency:"EUR",stock:1,available:true},{supplierVariantId:"XL",sku:null,title:"XL",cost:"10",currency:"EUR",stock:1,available:true}]};
  const result=calculateSupplierSnapshotPrices(snapshot,"EUR");
  assert.deepEqual(result.variants.map((variant)=>variant.calculation.finalSellingPrice),["10.00","12.50"]);
  assert.equal(result.basePrice,"10.00");assert.equal(result.marginGuaranteed,false);
});

test("admin preview/import remain authorized and supplier pricing stays out of buyer responses",()=>{
  const preview=readFileSync("app/api/supplier/cj/pricing/route.ts","utf8"),importRoute=readFileSync("app/api/supplier/cj/import/route.ts","utf8"),buyer=readFileSync("app/api/products/route.ts","utf8"),page=readFileSync("app/product/[id]/page.tsx","utf8");
  assert.match(preview,/requirePlatformSupplierAdmin/);assert.match(importRoute,/requirePlatformSupplierAdmin/);
  assert.doesNotMatch(buyer,/supplierCost|targetMargin|totalIncludedCost/);assert.doesNotMatch(page,/supplierCost|targetMargin|totalIncludedCost/);
});

test("automatic import is default while reviewed manual override remains explicit",()=>{
  const component=readFileSync("components/SupplierProductManager.tsx","utf8"),route=readFileSync("app/api/supplier/cj/import/route.ts","utf8"),products=readFileSync("lib/suppliers/supplier-products.ts","utf8");
  assert.match(component,/useState\(false\)[\s\S]*pricingMode:manual\?"MANUAL":"AUTOMATIC"/);
  assert.match(route,/body\.pricingMode === "MANUAL"/);
  assert.match(products,/priceOverride:variantPrice/);
  assert.match(products,/status:"DRAFT"/);
});

test("automatic import persists the base price and variant-specific overrides",async()=>{
  let productData:any;const variants:any[]=[];
  const tx:any={product:{create:async({data}:any)=>{productData=data;return{id:"product"};}},productOption:{create:async()=>({id:"option"})},productOptionValue:{create:async({data}:any)=>({id:`value-${data.position}`})},productVariant:{create:async({data}:any)=>{variants.push(data);return{id:`variant-${variants.length}`};}},productVariantValue:{create:async()=>({})}};
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async()=>null},product:{findUnique:async()=>null},$transaction:async(callback:any)=>callback(tx)};
  const snapshot:any={provider:"CJ",supplierProductId:"PID",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:"8",currency:"EUR",stock:2,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"S",sku:null,title:"S",cost:"8",currency:"EUR",stock:1,available:true},{supplierVariantId:"XL",sku:null,title:"XL",cost:"10",currency:"EUR",stock:1,available:true}]};
  await importSupplierProduct(db,{id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot},{copyRemote:async()=>{throw new Error("unexpected");}},{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID",sellingCurrency:"EUR",category:"women--outerwear--blazers"});
  assert.equal(productData.price,"10.00");assert.equal(productData.status,"DRAFT");
  assert.deepEqual(variants.map((variant)=>variant.priceOverride),["10.00","12.50"]);
});

test("automatic import resolves verified FX and maps each supplier currency independently",async()=>{
  const originalFetch=globalThis.fetch,originalKey=process.env.OPEN_EXCHANGE_RATES_APP_ID;
  let fetchCalls=0,productData:any;const variants:any[]=[];
  globalThis.fetch=(async()=>{fetchCalls++;return new Response(JSON.stringify({base:"USD",timestamp:Math.floor(Date.now()/1000),rates:{USD:1,EUR:.9,GBP:.75}}),{status:200});}) as typeof fetch;
  process.env.OPEN_EXCHANGE_RATES_APP_ID="test-app-id";
  resetFxCacheForTests();
  const tx:any={product:{create:async({data}:any)=>{productData=data;return{id:"product"};}},productOption:{create:async()=>({id:"option"})},productOptionValue:{create:async({data}:any)=>({id:`value-${data.position}`})},productVariant:{create:async({data}:any)=>{variants.push(data);return{id:`variant-${variants.length}`};}},productVariantValue:{create:async()=>({})}};
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async()=>null},product:{findUnique:async()=>null},$transaction:async(callback:any)=>callback(tx)};
  const snapshot:any={provider:"CJ",supplierProductId:"PID-FX",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:"8",currency:"USD",stock:2,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"USD",sku:null,title:"USD",cost:"8",currency:"USD",stock:1,available:true},{supplierVariantId:"GBP",sku:null,title:"GBP",cost:"8",currency:"GBP",stock:1,available:true}]};
  try{
    await importSupplierProduct(db,{id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot},{copyRemote:async()=>{throw new Error("unexpected");}},{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID-FX",sellingCurrency:"EUR",category:"women--outerwear--blazers"});
    assert.equal(productData.price,"9.00");assert.equal(productData.currency,"EUR");
    assert.deepEqual(variants.map((variant)=>variant.priceOverride),["9.00","12.00"]);
    assert.equal(fetchCalls,1);
  }finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPEN_EXCHANGE_RATES_APP_ID;else process.env.OPEN_EXCHANGE_RATES_APP_ID=originalKey;}
});

test("same-currency automatic import does not call the FX provider",async()=>{
  const originalFetch=globalThis.fetch;let productCreated=0;
  globalThis.fetch=(async()=>{throw new Error("FX must not be called");}) as typeof fetch;
  const tx:any={product:{create:async()=>{productCreated++;return{id:"product"};}},productOption:{create:async()=>({id:"option"})},productOptionValue:{create:async()=>({id:"value"})},productVariant:{create:async()=>({id:"variant"})},productVariantValue:{create:async()=>({})}};
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async()=>null},product:{findUnique:async()=>null},$transaction:async(callback:any)=>callback(tx)};
  const snapshot:any={provider:"CJ",supplierProductId:"PID-EUR",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:"8",currency:"EUR",stock:1,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"EUR",sku:null,title:"EUR",cost:"8",currency:"EUR",stock:1,available:true}]};
  try{await importSupplierProduct(db,{id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot},{copyRemote:async()=>{throw new Error("unexpected");}},{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID-EUR",sellingCurrency:"EUR",category:"women--outerwear--blazers"});assert.equal(productCreated,1);}
  finally{globalThis.fetch=originalFetch;}
});

test("automatic import fails before media or database creation when verified FX is unavailable stale or invalid",async()=>{
  const originalFetch=globalThis.fetch,originalKey=process.env.OPEN_EXCHANGE_RATES_APP_ID;
  let mediaCopies=0,transactions=0;
  const db:any={supplierConnection:{findFirst:async()=>({id:"platform-cj"})},supplierProductLink:{findUnique:async()=>null},product:{findUnique:async()=>null},$transaction:async()=>{transactions++;throw new Error("unexpected transaction");}};
  const snapshot:any={provider:"CJ",supplierProductId:"PID-FAIL",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:"8",currency:"USD",stock:1,available:true,weightGrams:null,media:[{type:"IMAGE",url:"https://example.com/image.jpg"}],rawMetadata:{},variants:[{supplierVariantId:"USD",sku:null,title:"USD",cost:"8",currency:"USD",stock:1,available:true}]};
  const provider:any={id:"CJ",isConfigured:()=>true,getProduct:async()=>snapshot};
  const media:any={copyRemote:async()=>{mediaCopies++;throw new Error("unexpected media copy");}};
  async function attempt(payload:unknown,key=true,status=200){if(key)process.env.OPEN_EXCHANGE_RATES_APP_ID="test-app-id";else delete process.env.OPEN_EXCHANGE_RATES_APP_ID;resetFxCacheForTests();globalThis.fetch=(async()=>new Response(JSON.stringify(payload),{status})) as typeof fetch;await assert.rejects(()=>importSupplierProduct(db,provider,media,{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID-FAIL",sellingCurrency:"EUR",category:"women--outerwear--blazers"}));}
  try{
    await attempt({},false);
    await attempt({error:true,code:"service_unavailable"},true,503);
    await attempt({base:"USD",timestamp:Math.floor((Date.now()-7*60*60*1000)/1000),rates:{EUR:.9}});
    await attempt({base:"USD",timestamp:Math.floor(Date.now()/1000),rates:{EUR:0}});
    assert.equal(mediaCopies,0);assert.equal(transactions,0);
  }finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPEN_EXCHANGE_RATES_APP_ID;else process.env.OPEN_EXCHANGE_RATES_APP_ID=originalKey;}
});

test("explicit resync populates missing costs without repricing or creating a product",async()=>{
  const updates:{link?:any;product?:any;variants:any[]}={variants:[]};
  const current={id:"link",provider:"CJ",connectionId:"platform-cj",supplierProductId:"PID",supplierCost:null,syncStatus:"HEALTHY",product:{id:"product",price:new Prisma.Decimal("19.99")}};
  const tx:any={supplierProductLink:{update:async({data}:any)=>{updates.link=data;}},product:{update:async({data}:any)=>{updates.product=data;}},productVariant:{updateMany:async({where,data}:any)=>{updates.variants.push({where,data});}}};
  const db:any={supplierProductLink:{findUnique:async()=>current,update:async()=>{}},$transaction:async(callback:any)=>callback(tx)};
  const provider:any={id:"CJ",getProduct:async()=>({provider:"CJ",supplierProductId:"PID",sku:"SPU",title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:8.24,currency:"USD",stock:12,available:true,weightGrams:null,media:[],rawMetadata:{},variants:[{supplierVariantId:"V1",sku:"SKU-1",title:"Small",cost:8.24,currency:"USD",stock:5,available:true},{supplierVariantId:"V2",sku:"SKU-2",title:"Large",cost:9.5,currency:"USD",stock:7,available:true}]})};
  const result=await syncSupplierProduct(db,provider,"product");
  assert.equal(updates.link.supplierCost,"8.24");
  assert.equal(updates.link.supplierCurrency,"USD");
  assert.equal(updates.link.supplierStock,12);
  assert.deepEqual(updates.variants.map(({data})=>data.supplierCost),["8.24","9.50"]);
  assert.deepEqual(updates.product,{stock:12});
  assert.equal(result.sellingPricePreserved,"19.99");
  assert.equal("price" in updates.product,false);
});
