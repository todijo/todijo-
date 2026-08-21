import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjProduct } from "../lib/suppliers/cj-classification";
import type { SupplierProductSnapshot } from "../lib/suppliers/types";

function snapshot(title:string,categoryReference:string):SupplierProductSnapshot{
  return {
    provider:"CJ",
    supplierProductId:"cj-bag-regression",
    sku:null,
    title,
    description:"",
    categoryReference,
    sourceUrl:null,
    cost:1,
    currency:"USD",
    stock:1,
    available:true,
    weightGrams:null,
    variants:[],
    media:[],
    rawMetadata:{},
  };
}

test("Bags & Shoes umbrella label does not turn an explicit women's handbag into unresolved shoes",()=>{
  const result=classifyCjProduct(snapshot(
    "Women's Genuine Leather Crossbody Tote Handbag",
    "Bags & Shoes > Women Bags > Tote Bags",
  ));
  assert.equal(result.status,"SUGGESTED");
  assert.equal(result.categoryId,"bags-shoes");
  assert.ok(result.subcategoryLabel==="Sacs à bandoulière pour femme"||result.subcategoryLabel==="Sac à main");
  assert.ok(result.confidence>=0.9);
});

test("taxonomy demographic words do not override an explicit tote handbag product title",()=>{
  const result=classifyCjProduct(snapshot(
    "Square Rattan Straw Crossbody Tote Handbag",
    "Bags & Shoes > Kids Bags > Tote Bags",
  ));
  assert.equal(result.status,"SUGGESTED");
  assert.equal(result.categoryId,"bags-shoes");
  assert.equal(result.subcategoryLabel,"Sac à main");
  assert.ok(result.confidence>=0.9);
});

test("real shoe title still follows shoe review safeguards",()=>{
  const result=classifyCjProduct(snapshot(
    "Women's Leather Shoes",
    "Bags & Shoes > Women Shoes > Casual Shoes",
  ));
  assert.equal(result.status,"NEEDS_REVIEW");
  assert.equal(result.categoryId,null);
  assert.ok(result.confidence<0.62);
});
