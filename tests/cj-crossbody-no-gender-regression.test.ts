import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjProduct } from "../lib/suppliers/cj-classification";
import type { SupplierProductSnapshot } from "../lib/suppliers/types";

function snapshot(title:string):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:"cj-crossbody",sku:null,title,description:"",categoryReference:null,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:null,variants:[],media:[],rawMetadata:{}}}

test("live CJ crossbody tote without explicit gender is still an explicit bag product",()=>{
  const result=classifyCjProduct(snapshot("Trendy High-end Genuine Leather Tote Crossbody Shoulder Bag"));
  assert.equal(result.status,"SUGGESTED");
  assert.equal(result.categoryId,"bags-shoes");
  assert.equal(result.subcategoryLabel,"Sacs à bandoulière pour femme");
  assert.ok(result.confidence>=.9);
});

test("generic tote bag remains a bag and never falls to generic review",()=>{
  const result=classifyCjProduct(snapshot("Large Capacity Leather Tote Bag"));
  assert.equal(result.status,"SUGGESTED");
  assert.equal(result.categoryId,"bags-shoes");
  assert.equal(result.subcategoryLabel,"Sac à main");
  assert.ok(result.confidence>=.9);
});
