import test from "node:test";
import assert from "node:assert/strict";
import { CJ_TAXONOMY_GAP_LEAVES, MARKETPLACE_CANONICAL_LEAF_CATEGORIES, isMarketplaceCanonicalLeafCategoryId, resolveCjGapLeaf } from "../lib/marketplace-category-taxonomy";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";

test("every reviewed CJ taxonomy gap resolves to a real additive marketplace leaf",()=>{
  const paths=new Set<string>();
  const ids=new Set(MARKETPLACE_CANONICAL_LEAF_CATEGORIES.map(leaf=>leaf.id));
  for(const row of CJ_TAXONOMY_GAP_LEAVES){
    assert.equal(paths.has(row.cjPath),false,`duplicate CJ path: ${row.cjPath}`);
    paths.add(row.cjPath);
    const id=resolveCjGapLeaf(row.cjPath);
    assert.ok(id,row.cjPath);
    assert.equal(ids.has(id!),true,row.cjPath);
    assert.equal(isMarketplaceCanonicalLeafCategoryId(id!),true,row.cjPath);
  }
});

test("representative production gaps map deterministically without title heuristics",()=>{
  const samples=[
    ["AUTO", "Automobiles & Motorcycles", "Tools, Maintenance & Care", "Diagnostic Tools", "auto"],
    ["BIRD", "Pet Supplies", "Bird Supplies", "Bird Cages", "pets"],
    ["SPORT", "Sports & Outdoors", "Sportswear", "Sports Bags", "sports"],
    ["WOMEN", "Women's Clothing", "Women's Denim", "Women's Denim Jackets", "women"],
    ["ELECTRONICS", "Consumer Electronics", "Accessories & Parts", "Audio & Video Cables", "electronics"],
  ] as const;
  for(const [categoryId,first,second,third,expected] of samples){
    const result=mapCjCategoryPathToTodijo({categoryId,first,second,third});
    assert.equal(result?.status,"SUGGESTED",third);
    assert.equal(result?.categoryId,expected,third);
    assert.ok((result?.confidence??0)>=.99,third);
    assert.ok(result?.evidence.some(item=>item.includes("REVIEWED_TAXONOMY_GAP_EXTENSION")),third);
  }
});

test("regulated and adult-wellness production paths stay intentionally unmapped",()=>{
  for(const [categoryId,first,second,third] of [
    ["HEALTH","Health, Beauty & Hair","Food & Health","Health Care Products"],
    ["ADULT","Home, Garden & Furniture","Home Storage","Adult Wellness"],
  ] as const){
    assert.equal(resolveCjGapLeaf(`${first} > ${second} > ${third}`),null);
    const result=mapCjCategoryPathToTodijo({categoryId,first,second,third});
    assert.notEqual(result?.evidence.find(item=>item.includes("REVIEWED_TAXONOMY_GAP_EXTENSION")),true);
  }
});
