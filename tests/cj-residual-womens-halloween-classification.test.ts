import test from "node:test";
import assert from "node:assert/strict";
import { classifyCjProductByTaxonomyId } from "../lib/suppliers/cj-taxonomy-classifier";
import type { SupplierProductSnapshot } from "../lib/suppliers/types";

const sample: SupplierProductSnapshot = {provider:"CJ",supplierProductId:"2410190940451618400",sku:null,title:"Underwear Halloween Clothing Suit Women",description:"",categoryReference:null,categoryHierarchy:null,sourceUrl:null,cost:null,currency:"USD",stock:0,available:true,weightGrams:null,variants:[],media:[],rawMetadata:{}};

test("residual women Halloween preview classification", async () => {
  const result = await classifyCjProductByTaxonomyId(sample);
  assert.equal(result.status, "SUGGESTED");
  assert.equal(result.categoryId, "women");
  assert.equal(result.subcategoryLabel, "Costumes et Ensembles");
  assert.ok(result.confidence >= 0.9);
});
