import test from "node:test";
import assert from "node:assert/strict";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";
import { CJ_FINAL_SAFE_PATH_ALIASES } from "../lib/suppliers/cj-final-safe-path-aliases";
import { isMarketplaceCanonicalLeafCategoryId, marketplaceCanonicalLeafCategory } from "../lib/marketplace-category-registry";

function pathRow(path:string){const [first,second,third]=path.split(" > ");return{categoryId:`TEST-${third}`,first:first??"",second:second??"",third:third??""};}

test("all final safe live CJ gaps resolve to valid canonical leaves",()=>{
  assert.equal(CJ_FINAL_SAFE_PATH_ALIASES.length,13);
  for(const row of CJ_FINAL_SAFE_PATH_ALIASES){
    assert.ok(isMarketplaceCanonicalLeafCategoryId(row.canonicalCategoryId),row.path);
    assert.ok(marketplaceCanonicalLeafCategory(row.canonicalCategoryId),row.path);
    const mapped=mapCjCategoryPathToTodijo(pathRow(row.path));
    assert.ok(mapped,row.path);
    assert.equal(mapped.canonicalCategoryId,row.canonicalCategoryId,row.path);
    assert.equal(mapped.status,"SUGGESTED",row.path);
    assert.ok(mapped.confidence>=0.99,row.path);
    assert.ok(mapped.evidence.some(item=>item.includes("REVIEWED_FINAL_SAFE_PATH_ALIAS")),row.path);
  }
});

test("regulated and prescription branches remain fail-closed",()=>{
  const protectedPaths=[
    "Health, Beauty & Hair > Food & Health > Health Care Products",
    "Home, Garden & Furniture > Home Storage > Adult Wellness",
    "Men's Clothing > Accessories > Man Prescription Glasses",
    "Women's Clothing > Accessories > Woman Prescription Glasses",
  ];
  for(const path of protectedPaths)assert.equal(mapCjCategoryPathToTodijo(pathRow(path)),null,path);
});
