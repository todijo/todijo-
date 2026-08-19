import test from "node:test";
import assert from "node:assert/strict";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";

const path=(first:string,second:string,third:string)=>({categoryId:"CJ-CATEGORY-1",first,second,third});

test("CJ car stickers map from supplier taxonomy to Todijo exterior parts",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Exterior Accessories","Car Stickers"));
  assert.equal(result?.categoryId,"auto");
  assert.equal(result?.subcategoryLabel,"Pièces extérieures");
  assert.equal(result?.status,"SUGGESTED");
  assert.equal(result?.confidence,.99);
  assert.ok(result?.evidence.some(entry=>entry==="CJ_TAXONOMY_MAPPING:AUTO_EXTERIOR_DECORATION"));
});

test("CJ automotive decals also use the authoritative exterior mapping",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Exterior Accessories","Car Decals"));
  assert.equal(result?.subcategoryLabel,"Pièces extérieures");
});

test("CJ dash cameras map to the existing Todijo automotive electronics leaf",()=>{
  const result=mapCjCategoryPathToTodijo(path("Automobiles & Motorcycles","Car Electronics","DVR & Dash Camera"));
  assert.equal(result?.categoryId,"auto");
  assert.equal(result?.subcategoryLabel,"DVR & Dash Camera");
});

test("unknown CJ paths never invent a canonical category",()=>{
  assert.equal(mapCjCategoryPathToTodijo(path("Unknown","Unknown","Unmapped Novelty")),null);
});
