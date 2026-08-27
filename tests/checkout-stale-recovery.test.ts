import test from "node:test";
import assert from "node:assert/strict";
import {checkoutWithStaleRequestRecovery} from "../lib/checkout-request";

function storage(initial:Record<string,string>={}){const values=new Map(Object.entries(initial));return{values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value)};}

test("client replaces a stale request ID, retries once, and preserves the selected cart line",async()=>{
  const key="todijo-checkout:product:variant-blue:1",local=storage({[key]:"stale-request"}),cart=[{productId:"product",variantId:"variant-blue",quantity:1,unitAmountMinor:969}],seen:Array<{requestId:string;cart:typeof cart}>=[];
  const ids=["fresh-request"];
  const result=await checkoutWithStaleRequestRecovery<{code?:string;url?:string;unitAmountMinor?:number}>({storage:local,storageKey:key,createRequestId:()=>ids.shift()!,send:async(requestId)=>{seen.push({requestId,cart:structuredClone(cart)});return seen.length===1?{ok:false,status:409,result:{code:"CHECKOUT_REQUEST_STALE"}}:{ok:true,status:200,result:{url:"https://checkout.stripe.test/fresh",unitAmountMinor:969}};}});
  assert.equal(result.requestId,"fresh-request");assert.equal(result.attempts,2);assert.equal(local.getItem(key),"fresh-request");assert.deepEqual(seen.map(value=>value.requestId),["stale-request","fresh-request"]);assert.deepEqual(cart,[{productId:"product",variantId:"variant-blue",quantity:1,unitAmountMinor:969}]);assert.equal(result.result.unitAmountMinor,969);
});

test("client performs at most one stale-request retry",async()=>{
  const key="todijo-checkout:cart",local=storage({[key]:"stale-one"});let calls=0;
  const result=await checkoutWithStaleRequestRecovery({storage:local,storageKey:key,createRequestId:()=>"stale-two",send:async()=>{calls++;return{ok:false,status:409,result:{code:"CHECKOUT_REQUEST_STALE"}};}});
  assert.equal(calls,2);assert.equal(result.attempts,2);assert.equal(result.result.code,"CHECKOUT_REQUEST_STALE");assert.equal(local.getItem(key),"stale-two");
});
