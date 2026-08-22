import test from "node:test";
import assert from "node:assert/strict";
import { mapCjCategoryPathToTodijo } from "../lib/suppliers/cj-category-taxonomy";
import { CJ_POST_MERGE_PATH_ALIASES } from "../lib/suppliers/cj-post-merge-path-aliases";

function path(value:string){const [first,second,third]=value.split(" > ");return{categoryId:`test-${third}`,first:first??"",second:second??"",third:third??""};}

test("reviewed post-merge aliases resolve to accepted canonical leaves",()=>{
  assert.equal(CJ_POST_MERGE_PATH_ALIASES.length,14);
  for(const row of CJ_POST_MERGE_PATH_ALIASES){
    const result=mapCjCategoryPathToTodijo(path(row.path));
    assert.ok(result,row.path);
    assert.equal(result?.status,"SUGGESTED",row.path);
    assert.ok((result?.confidence??0)>=0.99,row.path);
    assert.equal(result?.canonicalCategoryId,row.canonicalCategoryId,row.path);
  }
});

test("regulated post-merge gaps remain fail-closed",()=>{
  const excluded=[
    "Health, Beauty & Hair > Food & Health > Health Care Products",
    "Home, Garden & Furniture > Home Storage > Adult Wellness",
    "Men's Clothing > Accessories > Man Prescription Glasses",
    "Women's Clothing > Accessories > Woman Prescription Glasses",
  ];
  for(const value of excluded){assert.equal(mapCjCategoryPathToTodijo(path(value)),null,value);}
});
