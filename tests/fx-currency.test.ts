import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currencyMinorUnits,preferredCurrencyForCountry,resolveBuyerCurrency,roundCurrencyUp,stripeMinorAmount,stripePresentmentSupported,SUPPORTED_BUYER_CURRENCIES} from "../lib/currency";
import {FxError,resetFxCacheForTests,verifiedFxRate} from "../lib/fx";
import {calculateSupplierPrice,convertSupplierPriceForBuyer} from "../lib/suppliers/pricing";
import {authorizedEmbeddedFreight} from "../lib/suppliers/dropshipping-pricing";

const currentPayload={base:"USD",timestamp:Math.floor(Date.now()/1000),rates:{USD:1,EUR:.92,GBP:.79,CAD:1.36,CHF:.88,JPY:150,AED:3.6725,SAR:3.75,QAR:3.64}};
function response(payload:unknown=currentPayload){return Promise.resolve(new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}}));}
function withKey(){process.env.OPEN_EXCHANGE_RATES_APP_ID="test-app-id-never-log";resetFxCacheForTests();}

test("verified USD rates convert safely to EUR GBP CAD CHF and preserve USD identity",async()=>{
  withKey();const fetcher=(async()=>response()) as typeof fetch;
  for(const [currency,expected] of [["EUR","0.92"],["GBP","0.79"],["CAD","1.36"],["CHF","0.88"],["AED","3.6725"],["SAR","3.75"],["QAR","3.64"]] as const)assert.equal((await verifiedFxRate("USD",currency,fetcher)).rate,expected);
  const identity=await verifiedFxRate("USD","USD",fetcher);assert.equal(identity.rate,"1");assert.equal(identity.provider,"IDENTITY");
});

test("FX conversion happens after the 20 percent margin and rounds upward by currency minor unit",async()=>{
  withKey();const calculation=calculateSupplierPrice({supplierCost:8,supplierCurrency:"USD",sellingCurrency:"USD",shipping:{status:"KNOWN",amount:4,currency:"USD"}}),fetcher=(async()=>response()) as typeof fetch;
  const eur=convertSupplierPriceForBuyer(calculation,"EUR",await verifiedFxRate("USD","EUR",fetcher));assert.equal(eur.finalSellingPrice,"13.8");assert.equal(eur.marginGuaranteed,true);
  const jpy=convertSupplierPriceForBuyer(calculation,"JPY",await verifiedFxRate("USD","JPY",fetcher));assert.equal(jpy.finalSellingPrice,"2250");assert.equal(currencyMinorUnits("JPY"),0);assert.equal(stripeMinorAmount(jpy.finalSellingPrice,"JPY"),2250);
  assert.equal(roundCurrencyUp("13.801","EUR").toString(),"13.81");assert.equal(stripeMinorAmount("13.81","EUR"),1381);
});

test("market defaults and explicit supported preferences are centralized and safe",()=>{
  assert.equal(preferredCurrencyForCountry("FR"),"EUR");assert.equal(preferredCurrencyForCountry("GB"),"GBP");assert.equal(preferredCurrencyForCountry("US"),"USD");
  assert.equal(resolveBuyerCurrency({explicitPreference:"CAD",shippingCountry:"FR"}),"CAD");assert.equal(resolveBuyerCurrency({explicitPreference:"XXX",shippingCountry:"GB"}),"GBP");
  for(const currency of ["AED","SAR","QAR","INR","BRL","ZAR"] as const)assert.equal(stripePresentmentSupported(currency),true);
  assert.equal(stripePresentmentSupported("XXX"),false);assert.equal(SUPPORTED_BUYER_CURRENCIES.length,26);
});

test("missing, stale and malformed FX data fail closed",async()=>{
  delete process.env.OPEN_EXCHANGE_RATES_APP_ID;resetFxCacheForTests();await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>response()) as typeof fetch),/FX_NOT_CONFIGURED/);
  withKey();await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>response({base:"USD",timestamp:Math.floor((Date.now()-7*60*60*1000)/1000),rates:{EUR:.9}})) as typeof fetch),/FX_RATE_STALE/);
  withKey();await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>response({base:"USD",timestamp:Math.floor(Date.now()/1000),rates:{EUR:0}})) as typeof fetch),FxError);
});

test("FX diagnostics classify provider failures without leaking the App ID",async()=>{
  const original=console.error,lines:string[]=[];console.error=(...values:unknown[])=>lines.push(values.join(" "));
  try{
    delete process.env.OPEN_EXCHANGE_RATES_APP_ID;resetFxCacheForTests();
    await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>response()) as typeof fetch),(error:unknown)=>error instanceof FxError&&error.code==="FX_NOT_CONFIGURED");
    withKey();
    await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>Promise.resolve(new Response(JSON.stringify({error:true,status:401,code:"invalid_app_id",message:"Invalid app_id=test-app-id-never-log"}),{status:401}))) as typeof fetch),(error:unknown)=>error instanceof FxError&&error.code==="FX_UNAVAILABLE");
    withKey();
    await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>Promise.resolve(new Response("not-json",{status:502}))) as typeof fetch),(error:unknown)=>error instanceof FxError&&error.code==="FX_RESPONSE_INVALID");
    assert.match(lines.join("\n"),/\[fx-api\]/);assert.match(lines.join("\n"),/MISSING_APP_ID/);assert.match(lines.join("\n"),/INVALID_APP_ID/);assert.match(lines.join("\n"),/MALFORMED_JSON/);
    assert.doesNotMatch(lines.join("\n"),/test-app-id-never-log/);assert.doesNotMatch(lines.join("\n"),/latest\.json\?app_id/);
  }finally{console.error=original;}
});

test("stale FX diagnostics expose timestamps and preserve the stable sanitized error",async()=>{
  const original=console.error,lines:string[]=[];console.error=(...values:unknown[])=>lines.push(values.join(" "));
  try{
    withKey();const timestamp=Math.floor((Date.now()-7*60*60*1000)/1000);
    await assert.rejects(()=>verifiedFxRate("USD","EUR",(async()=>response({base:"USD",timestamp,rates:{EUR:.9}})) as typeof fetch),(error:unknown)=>error instanceof FxError&&error.code==="FX_RATE_STALE");
    assert.match(lines.join("\n"),/"freshness":"STALE"/);assert.match(lines.join("\n"),/"internalErrorCode":"FX_RATE_STALE"/);assert.match(lines.join("\n"),new RegExp(String(timestamp)));
  }finally{console.error=original;}
});

test("free-shipping eligibility requires platform or approved seller ownership plus embedded verified freight",()=>{
  const pricing={pricing:{shippingStatus:"KNOWN",marginGuaranteed:true,freightEmbedded:true}};
  assert.equal(authorizedEmbeddedFreight({ownerType:"PLATFORM",sourceMetadata:pricing}),true);
  assert.equal(authorizedEmbeddedFreight({ownerType:"SELLER",connectionStatus:"CONNECTED",sellerDropshippingEnabled:true,sourceMetadata:pricing}),true);
  assert.equal(authorizedEmbeddedFreight({ownerType:"SELLER",connectionStatus:"CONNECTED",sellerDropshippingEnabled:false,sourceMetadata:pricing}),false);
  assert.equal(authorizedEmbeddedFreight({ownerType:"PLATFORM",sourceMetadata:{pricing:{shippingStatus:"DEFERRED",marginGuaranteed:false,freightEmbedded:false}}}),false);
});

test("buyer routes still expose no supplier cost freight margin or FX provider metadata",()=>{
  const buyer=readFileSync("app/api/products/route.ts","utf8"),checkout=readFileSync("lib/payments.ts","utf8");
  assert.doesNotMatch(buyer,/supplierCost|totalIncludedCost|OPEN_EXCHANGE_RATES|targetMargin/);assert.doesNotMatch(checkout,/OPEN_EXCHANGE_RATES_APP_ID/);
});
