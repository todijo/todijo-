import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjProduct } from "../lib/suppliers/cj-classification";
import type { SupplierProductSnapshot } from "../lib/suppliers/types";

function snapshot(title:string):SupplierProductSnapshot{
  return {provider:"CJ",supplierProductId:"2410190940451618400",sku:null,title,description:"",categoryReference:null,categoryHierarchy:null,sourceUrl:null,cost:null,currency:"USD",stock:0,available:true,weightGrams:null,variants:[],media:[],rawMetadata:{}};
}

test("women Halloween clothing suit does not fall into generic 40% review",()=>{
  const result=classifyCjProduct(snapshot("Underwear Halloween Clothing Suit Women"));
  assert.equal(result.status,"SUGGESTED");
  assert.equal(result.categoryId,"women");
  assert.equal(result.subcategoryLabel,"Costumes et Ensembles");
  assert.ok(result.confidence>=0.9);
});
