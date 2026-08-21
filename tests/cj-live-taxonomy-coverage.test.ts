import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalLeafCategoryId } from "../lib/desktop-category-taxonomy";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";
import { CJ_LIVE_PATH_ALIASES, resolveCjLivePathAlias } from "../lib/suppliers/cj-live-path-aliases";

test("reviewed live CJ path aliases are unique and always target real Todijo leaves",()=>{
  assert.ok(CJ_LIVE_PATH_ALIASES.length>=400);
  const paths=new Set<string>();
  for(const row of CJ_LIVE_PATH_ALIASES){
    assert.ok(row.path.split(" > ").length===3,row.path);
    assert.ok(!paths.has(row.path),`duplicate live CJ path: ${row.path}`);
    assert.ok(isCanonicalLeafCategoryId(row.canonicalCategoryId),`invalid Todijo target for ${row.path}: ${row.canonicalCategoryId}`);
    paths.add(row.path);
  }
});

test("representative live CJ families resolve from reviewed path aliases before heuristics",()=>{
  const samples=[
    ["Computer & Office","Storage Devices","SSD","computers"],
    ["Consumer Electronics","Portable Audio & Video","Speakers","electronics"],
    ["Pet Supplies","Pet Collars, Harnesses & Accessories","Pet Collars","pets"],
    ["Home, Garden & Furniture","Home Textiles","Pillows","home"],
    ["Home Improvement","Indoor Lighting","Ceiling Lights","improvement"],
    ["Phones & Accessories","Mobile Phone Accessories","Chargers","phones"],
    ["Sports & Outdoors","Sneakers","Running Shoes","sports"],
    ["Toys, Kids & Babies","Toys & Hobbies","Blocks","kids"],
    ["Women's Clothing","Weddings & Events","Wedding Dresses","women"],
    ["Men's Clothing","Bottoms","Man Jeans","men"],
    ["Bags & Shoes","Women's Luggage & Bags","Women's Crossbody Bags","bags-shoes"],
    ["Automobiles & Motorcycles","Interior Accessories","Automobiles Seat Covers","auto"],
  ] as const;
  for(const [first,second,third,categoryId] of samples){
    const result=mapCjCategoryPathToTodijo({categoryId:`test-${categoryId}`,first,second,third});
    assert.equal(result?.status,"SUGGESTED",`${first} > ${second} > ${third}`);
    assert.equal(result?.categoryId,categoryId,`${first} > ${second} > ${third}`);
    assert.ok((result?.confidence??0)>=.99,`${first} > ${second} > ${third}`);
    assert.ok(result?.evidence.includes("CJ_TAXONOMY_MAPPING:REVIEWED_LIVE_PATH_ALIAS"),`${first} > ${second} > ${third}`);
  }
});

test("regulated or ambiguous live CJ branches remain intentionally unmapped",()=>{
  for(const path of [
    "Health, Beauty & Hair > Food & Health > Health Care Products",
    "Home, Garden & Furniture > Home Storage > Adult Wellness",
  ]) assert.equal(resolveCjLivePathAlias(path),null,path);
});
