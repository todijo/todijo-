import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCjCategoryHierarchy, normalizeCjProduct } from "../lib/suppliers/cj-client";
import { classifyCjProductAuthoritatively } from "../lib/suppliers/cj-category-taxonomy";

test("CJ product normalization preserves explicit supplier hierarchy fields",()=>{
  const hierarchy=normalizeCjCategoryHierarchy({
    categoryId:"third-1",
    categoryName:"Bags & Shoes > Women Bags > Tote Bags",
    categoryFirstId:"first-1",
    categoryFirstName:"Bags & Shoes",
    categorySecondId:"second-1",
    categorySecondName:"Women Bags",
    categoryThirdId:"third-1",
    categoryThirdName:"Tote Bags",
  });
  assert.deepEqual(hierarchy,{
    categoryId:"third-1",
    categoryName:"Bags & Shoes > Women Bags > Tote Bags",
    firstCategoryId:"first-1",
    firstCategoryName:"Bags & Shoes",
    secondCategoryId:"second-1",
    secondCategoryName:"Women Bags",
    thirdCategoryId:"third-1",
    thirdCategoryName:"Tote Bags",
  });
});

test("CJ full categoryName path is preserved even when level-name fields are absent",()=>{
  const snapshot=normalizeCjProduct({
    pid:"2077999420410269697",
    productNameEn:"Women's Genuine Leather Crossbody Tote Handbag",
    categoryId:"third-2",
    categoryName:"Bags & Shoes / Women Bags / Tote Bags",
    saleStatus:"3",
  },{list:[]},{data:{variantInventories:[]}});
  assert.equal(snapshot.categoryReference,"third-2");
  assert.equal(snapshot.categoryHierarchy?.firstCategoryName,"Bags & Shoes");
  assert.equal(snapshot.categoryHierarchy?.secondCategoryName,"Women Bags");
  assert.equal(snapshot.categoryHierarchy?.thirdCategoryName,"Tote Bags");
  assert.equal(snapshot.rawMetadata.categoryName,"Bags & Shoes / Women Bags / Tote Bags");
});

test("authoritative embedded CJ tote hierarchy resolves before text fallback",async()=>{
  const snapshot=normalizeCjProduct({
    pid:"2077999420410269697",
    productNameEn:"Women's Genuine Leather Crossbody Tote Handbag",
    categoryId:"third-3",
    categoryName:"Bags & Shoes > Women Bags > Tote Bags",
    saleStatus:"3",
  },{list:[]},{data:{variantInventories:[]}});
  const result=await classifyCjProductAuthoritatively(snapshot);
  assert.equal(result.categoryId,"bags-shoes");
  assert.equal(result.subcategoryLabel,"Sac à main");
  assert.equal(result.confidence,.99);
  assert.ok(result.evidence.includes("CJ_TAXONOMY_MAPPING:WOMEN_HANDBAG_OR_TOTE"));
});
