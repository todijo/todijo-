import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buyerSafeDropshippingResult,DropshippingCommerceError,resolveDropshippingEligibility,resolveDropshippingPricing} from "../lib/suppliers/commerce-pricing";
import type {SupplierProductSnapshot} from "../lib/suppliers/types";

const snapshot:SupplierProductSnapshot={provider:"CJ",supplierProductId:"CJ-PID",sku:"CJ-SKU",title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:8.24,currency:"USD",stock:10,available:true,weightGrams:100,media:[],rawMetadata:{},variants:[{supplierVariantId:"CJ-VID",sku:"CJ-VSKU",title:"Black",cost:8.24,currency:"USD",stock:10,available:true,originCountryCodes:["CN"]}]};
function db(overrides:Record<string,unknown>={}){const product={id:"product-1",price:{toString:()=>"20.00"},currency:"EUR",supplierLink:{provider:"CJ",ownerType:"PLATFORM",connectionId:"connection-1",supplierProductId:"CJ-PID",sourceMetadata:{pricing:{mode:"AUTOMATIC"}},connection:{status:"CONNECTED",store:null}},variants:[{id:"variant-1",priceOverride:null,supplierVariantId:"CJ-VID",supplierConnectionId:"connection-1"}],...overrides};return{product:{findFirst:async()=>product}} as never;}
function dependencies(custom:Partial<SupplierProductSnapshot>={}){return{provider:{getProduct:async()=>({...snapshot,...custom}),calculateFreight:async(input:{variantId:string;quantity:number})=>({selected:{id:"yun",name:"YunExpress Clothing Line",amount:"4.75",currency:"USD" as const,estimatedDelivery:"8-15 days",originCountry:"CN",destinationCountry:"FR"},methods:[],variantId:input.variantId,quantity:input.quantity,calculatedAt:new Date().toISOString(),cached:false})},fx:async(base:unknown,quote:unknown)=>({provider:"OPEN_EXCHANGE_RATES" as const,baseCurrency:base as "USD",quoteCurrency:quote as "EUR",rate:"0.866341",fetchedAt:new Date().toISOString(),effectiveAt:new Date().toISOString()})};}

test("eligibility is explicit for platform, approved seller, unauthorized seller and normal products",()=>{
 assert.equal(resolveDropshippingEligibility({hasSupplierLink:true,provider:"CJ",ownerType:"PLATFORM",connectionStatus:"CONNECTED"}).eligible,true);
 assert.equal(resolveDropshippingEligibility({hasSupplierLink:true,provider:"CJ",ownerType:"SELLER",connectionStatus:"CONNECTED",sellerDropshippingEnabled:true}).eligible,true);
 assert.equal(resolveDropshippingEligibility({hasSupplierLink:true,provider:"CJ",ownerType:"SELLER",connectionStatus:"CONNECTED",sellerDropshippingEnabled:false}).reason,"SELLER_NOT_AUTHORIZED");
 assert.equal(resolveDropshippingEligibility({hasSupplierLink:false}).pricingMode,"NORMAL_MARKETPLACE");
});

test("automatic pricing resolves variant cost, France freight, true margin, EUR FX and embedded free shipping",async()=>{
 const result=await resolveDropshippingPricing(db(),{productId:"product-1",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},dependencies());
 assert.equal(result.snapshot?.supplierUnitCost,"8.24");assert.equal(result.snapshot?.freightTotal,"4.75");assert.equal(result.snapshot?.includedCost,"12.99");assert.equal(result.snapshot?.calculatedSellingPrice,"16.24");
 assert.equal(result.buyer?.buyerUnitPrice,"14.07");assert.equal(result.buyer?.buyerLineTotal,"14.07");assert.equal(result.buyer?.freeShipping,true);assert.equal(result.buyer?.shippingIncluded,true);assert.deepEqual([result.buyer?.deliveryMinDays,result.buyer?.deliveryMaxDays],[8,15]);
});

test("quantity is line scoped and included in the freight request and line total",async()=>{
 let quantity=0;const deps=dependencies();const original=deps.provider.calculateFreight;deps.provider.calculateFreight=async(input)=>{quantity=input.quantity;return original(input);};
 const result=await resolveDropshippingPricing(db(),{productId:"product-1",variantId:"variant-1",quantity:2,destinationCountry:"FR",buyerCurrency:"EUR"},deps);
 assert.equal(quantity,2);assert.equal(result.buyer?.buyerLineTotal,"28.14");
});

test("exact variants may price differently while each keeps the true twenty percent margin",async()=>{
 const variants=[{supplierVariantId:"CJ-A",sku:null,title:"A",cost:8,currency:"USD",stock:5,available:true,originCountryCodes:["CN"]},{supplierVariantId:"CJ-B",sku:null,title:"B",cost:12,currency:"USD",stock:5,available:true,originCountryCodes:["CN"]}];
 const makeDb=(id:string,supplierVariantId:string)=>db({variants:[{id,priceOverride:null,supplierVariantId,supplierConnectionId:"connection-1"}]});
 const deps=dependencies({variants}); deps.fx=async(base:unknown,quote:unknown)=>({provider:"OPEN_EXCHANGE_RATES" as const,baseCurrency:base as "USD",quoteCurrency:quote as "EUR",rate:"1",fetchedAt:new Date().toISOString(),effectiveAt:new Date().toISOString()});
 const a=await resolveDropshippingPricing(makeDb("variant-a","CJ-A"),{productId:"product-1",variantId:"variant-a",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},deps);
 const b=await resolveDropshippingPricing(makeDb("variant-b","CJ-B"),{productId:"product-1",variantId:"variant-b",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},deps);
 assert.notEqual(a.buyer?.buyerUnitPrice,b.buyer?.buyerUnitPrice);
 for(const result of [a,b]){assert.equal(result.snapshot?.targetMargin,"0.2");assert.equal(Number(result.snapshot!.calculatedSellingPrice),Math.ceil((Number(result.snapshot!.includedCost)/.8)*100)/100);}
});

test("invalid or cross-product variants fail before any supplier call",async()=>{
 let called=false;const deps=dependencies();deps.provider.getProduct=async()=>{called=true;return snapshot;};
 await assert.rejects(()=>resolveDropshippingPricing(db({variants:[]}),{productId:"product-1",variantId:"foreign",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},deps),(error:unknown)=>error instanceof DropshippingCommerceError&&error.code==="DROPSHIPPING_VARIANT_INVALID");assert.equal(called,false);
});

test("freight and FX failures fail closed without substituting browser money",async()=>{
 const freight=dependencies();freight.provider.calculateFreight=async()=>{throw new Error("CJ_FREIGHT_FAILED");};
 await assert.rejects(()=>resolveDropshippingPricing(db(),{productId:"product-1",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},freight),/CJ_FREIGHT_FAILED/);
 const fx=dependencies();fx.fx=async()=>{throw new Error("FX_UNAVAILABLE");};
 await assert.rejects(()=>resolveDropshippingPricing(db(),{productId:"product-1",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},fx),/FX_UNAVAILABLE/);
});

test("manual override stays explicit and never claims embedded free shipping",async()=>{
 const result=await resolveDropshippingPricing(db({supplierLink:{provider:"CJ",ownerType:"PLATFORM",connectionId:"connection-1",supplierProductId:"CJ-PID",sourceMetadata:{pricing:{mode:"MANUAL_OVERRIDE"}},connection:{status:"CONNECTED",store:null}},variants:[{id:"variant-1",priceOverride:{toString:()=>"20.00"},supplierVariantId:"CJ-VID",supplierConnectionId:"connection-1"}]}),{productId:"product-1",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},dependencies());
 assert.equal(result.buyer?.pricingMode,"MANUAL_OVERRIDE");assert.equal(result.buyer?.freeShipping,false);assert.equal(result.buyer?.shippingIncluded,false);
});

test("buyer contract excludes supplier cost, freight amounts, margin and FX metadata",async()=>{
 const result=await resolveDropshippingPricing(db(),{productId:"product-1",variantId:"variant-1",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},dependencies()),buyer=buyerSafeDropshippingResult(result),serialized=JSON.stringify(buyer);
 assert.doesNotMatch(serialized,/supplierUnitCost|freightTotal|includedCost|targetMargin|fx|pricingSource/);assert.equal("buyerUnitPrice" in buyer,true);
 const route=readFileSync("app/api/products/[id]/dropshipping-pricing/route.ts","utf8");assert.match(route,/buyerSafeDropshippingResult/);assert.doesNotMatch(route,/supplierCost|freightTotal|targetMargin/);
});

test("normal marketplace lines remain in their existing pricing and shipping path",async()=>{
 const result=await resolveDropshippingPricing(db({supplierLink:null,variants:[]}),{productId:"product-1",variantId:"",quantity:1,destinationCountry:"FR",buyerCurrency:"EUR"},dependencies());
 assert.deepEqual(buyerSafeDropshippingResult(result),{eligible:false,pricingMode:"NORMAL_MARKETPLACE",freeShipping:false,shippingIncluded:false});
});
