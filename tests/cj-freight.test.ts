import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CjCatalogProvider} from "../lib/suppliers/cj-client";
import {CjFreightError,normalizeCjFreightMethods,selectCjFreightMethod} from "../lib/suppliers/cj-freight";
import {calculateSupplierPrice,calculateSupplierVariantPriceWithFreight} from "../lib/suppliers/pricing";

test("CJ freight uses the documented POST payload with exact destination variant and quantity",async()=>{
  let url="",init:RequestInit|undefined;
  const provider=new CjCatalogProvider({isConfigured:()=>true,getAccessToken:async()=>"secret-token",invalidateAccessToken:()=>{}},{minimumRequestIntervalMs:0,fetcher:async(input,options)=>{url=String(input);init=options;return new Response(JSON.stringify({code:200,result:true,message:"Success",data:[{logisticName:"CJPacket",logisticAging:"5-9",logisticPrice:4}]}),{status:200,headers:{"Content-Type":"application/json"}});}});
  const quote=await provider.calculateFreight({originCountry:"CN",destinationCountry:"DE",variantId:"VID-QUANTITY-TEST",quantity:2});
  assert.match(url,/\/logistic\/freightCalculate$/);assert.equal(init?.method,"POST");
  assert.deepEqual(JSON.parse(String(init?.body)),{startCountryCode:"CN",endCountryCode:"DE",products:[{quantity:2,vid:"VID-QUANTITY-TEST"}]});
  assert.equal(quote.selected.amount,"4.00");assert.equal(quote.selected.currency,"USD");assert.equal(quote.quantity,2);
  assert.doesNotMatch(JSON.stringify({url,body:init?.body}),/secret-token/);
});

test("identical freight inputs use the short-lived cache without crossing destination keys",async()=>{
  let calls=0;
  const provider=new CjCatalogProvider({isConfigured:()=>true,getAccessToken:async()=>"cache-token",invalidateAccessToken:()=>{}},{minimumRequestIntervalMs:0,fetcher:async()=>{calls++;return new Response(JSON.stringify({code:200,result:true,data:[{logisticName:"Cached",logisticAging:"4-7",logisticPrice:3}]}),{status:200,headers:{"Content-Type":"application/json"}});}});
  const input={originCountry:"CN",destinationCountry:"GB",variantId:"VID-CACHE-UNIQUE",quantity:3};
  assert.equal((await provider.calculateFreight(input)).cached,false);
  assert.equal((await provider.calculateFreight(input)).cached,true);
  await provider.calculateFreight({...input,destinationCountry:"US"});
  assert.equal(calls,2);
});

test("CJ freight upstream errors remain sanitized and empty methods fail closed",async()=>{
  const provider=new CjCatalogProvider({isConfigured:()=>true,getAccessToken:async()=>"never-expose-token",invalidateAccessToken:()=>{}},{minimumRequestIntervalMs:0,fetcher:async()=>new Response(JSON.stringify({code:1600100,result:false,message:"Param error never-expose-token",data:null}),{status:400,headers:{"Content-Type":"application/json"}})});
  await assert.rejects(()=>provider.calculateFreight({originCountry:"CN",destinationCountry:"FR",variantId:"VID-ERROR-UNIQUE",quantity:1}),/CJ_API_REQUEST_FAILED/);
  assert.throws(()=>normalizeCjFreightMethods(null,"CN","FR"),/CJ_FREIGHT_RESPONSE_INVALID/);
});

test("multiple freight methods select the cheapest valid method with delivery data, not the first",()=>{
  const methods=normalizeCjFreightMethods([{logisticName:"Expensive",logisticAging:"2-3",logisticPrice:9},{logisticName:"Invalid",logisticPrice:1},{logisticName:"Value",logisticAging:"5-8",totalPostageFee:4.5,logisticPrice:4}],"CN","FR");
  assert.equal(selectCjFreightMethod(methods).name,"Value");
  assert.equal(selectCjFreightMethod(methods,"Expensive").name,"Expensive");
  assert.throws(()=>selectCjFreightMethod([],undefined),CjFreightError);
  assert.throws(()=>selectCjFreightMethod(methods,"Unavailable"),/CJ_FREIGHT_METHOD_UNAVAILABLE/);
});

test("freight pricing preserves the 20 percent margin with supported fees and compatible USD",()=>{
  const withoutFee=calculateSupplierPrice({supplierCost:8,supplierCurrency:"USD",sellingCurrency:"USD",shipping:{status:"KNOWN",amount:4,currency:"USD"}});
  const withFee=calculateSupplierPrice({supplierCost:8,supplierCurrency:"USD",sellingCurrency:"USD",shipping:{status:"KNOWN",amount:4,currency:"USD"},fees:[{name:"supported",amount:1,currency:"USD"}]});
  assert.equal(withoutFee.totalIncludedCost,"12.00");assert.equal(withoutFee.finalSellingPrice,"15.00");assert.equal(withoutFee.marginGuaranteed,true);
  assert.equal(withFee.totalIncludedCost,"13.00");assert.equal(withFee.finalSellingPrice,"16.25");
});

test("variant and destination freight remain distinct and currency mismatch fails closed",()=>{
  const snapshot:any={variants:[{supplierVariantId:"A",cost:8,currency:"USD"},{supplierVariantId:"B",cost:10,currency:"USD"}]};
  assert.equal(calculateSupplierVariantPriceWithFreight(snapshot,"A",{amount:4,currency:"USD"}).finalSellingPrice,"15.00");
  assert.equal(calculateSupplierVariantPriceWithFreight(snapshot,"B",{amount:6,currency:"USD"}).finalSellingPrice,"20.00");
  assert.throws(()=>calculateSupplierVariantPriceWithFreight(snapshot,"A",{amount:4,currency:"EUR"}),/PRICING_CURRENCY_CONVERSION_REQUIRED/);
});

test("freight preview remains admin-only and private pricing stays out of buyer APIs",()=>{
  const route=readFileSync("app/api/supplier/cj/pricing/route.ts","utf8"),buyer=readFileSync("app/api/products/route.ts","utf8");
  assert.match(route,/requirePlatformSupplierAdmin/);assert.match(route,/calculateFreight/);assert.doesNotMatch(buyer,/supplierCost|shippingCost|totalIncludedCost|targetMargin/);
});
