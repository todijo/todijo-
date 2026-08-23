import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveCjFreightAcrossOrigins} from "../lib/suppliers/cj-origin-freight";

test("multi-origin freight tries every CJ origin sequentially and chooses the cheapest valid quote",async()=>{
 const calls:string[]=[];
 const quote=await resolveCjFreightAcrossOrigins({calculateFreight:async(input)=>{calls.push(input.originCountry);return{selected:{id:input.originCountry,name:`${input.originCountry} method`,amount:input.originCountry==="CN"?"7.50":"4.75",currency:"USD" as const,estimatedDelivery:input.originCountry==="CN"?"8-15 days":"6-12 days",originCountry:input.originCountry,destinationCountry:input.destinationCountry},methods:[],variantId:input.variantId,quantity:input.quantity,calculatedAt:new Date().toISOString(),cached:false};}},{originCountryCodes:["CN","US","CN"],destinationCountry:"FR",variantId:"CJ-VID",quantity:1});
 assert.deepEqual(calls,["CN","US"]);assert.equal(quote.selected.originCountry,"US");assert.equal(quote.selected.amount,"4.75");
});

test("one unavailable origin does not block another valid CJ warehouse",async()=>{
 const quote=await resolveCjFreightAcrossOrigins({calculateFreight:async(input)=>{if(input.originCountry==="CN")throw new Error("CJ_FREIGHT_NO_METHODS");return{selected:{id:"ok",name:"Available",amount:"5.00",currency:"USD" as const,estimatedDelivery:"7-10 days",originCountry:input.originCountry,destinationCountry:input.destinationCountry},methods:[],variantId:input.variantId,quantity:input.quantity,calculatedAt:new Date().toISOString(),cached:false};}},{originCountryCodes:["CN","DE"],destinationCountry:"FR",variantId:"CJ-VID",quantity:1});
 assert.equal(quote.selected.originCountry,"DE");
});

test("commerce pricing no longer rejects a selected variant merely because CJ reports multiple origins",()=>{
 const source=readFileSync("lib/suppliers/commerce-pricing.ts","utf8");
 assert.match(source,/resolveCjFreightAcrossOrigins/);assert.doesNotMatch(source,/originCountryCodes\.length!==1/);assert.match(source,/originCountry:freight\.selected\.originCountry/);
});
