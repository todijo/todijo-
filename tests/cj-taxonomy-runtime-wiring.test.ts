import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const classifier=readFileSync(resolve(process.cwd(),"lib/suppliers/cj-taxonomy-classifier.ts"),"utf8");
const preview=readFileSync(resolve(process.cwd(),"app/api/admin/supplier-products/catalog-preview/route.ts"),"utf8");

test("CJ preview classifies by stable taxonomy ID before legacy fallback",()=>{
  assert.match(classifier,/getCjCategoryTaxonomySnapshot/);
  assert.match(classifier,/resolveCjCategoryIdMapping/);
  assert.match(classifier,/CJ_TAXONOMY_ID_MAPPING/);
  assert.match(classifier,/return classifyCjProductAuthoritatively\(snapshot\)/);
  assert.match(preview,/classifyCjProductByTaxonomyId/);
  assert.doesNotMatch(preview,/classifyCjProductAuthoritatively/);
});

test("CJ preview resolves the full live taxonomy path by category ID before embedded fallback",()=>{
  assert.match(classifier,/resolveCjCategoryPath\(categoryId\)/);
  assert.match(classifier,/mapCjCategoryPathToTodijo\(resolvedPath\)/);
  assert.match(classifier,/CJ_PREVIEW_RESOLVED_FULL_PATH_BY_ID/);
  const resolvedPathIndex=classifier.indexOf("resolveCjCategoryPath(categoryId)");
  const fallbackIndex=classifier.indexOf("return classifyCjProductAuthoritatively(snapshot)");
  assert.ok(resolvedPathIndex>=0&&fallbackIndex>resolvedPathIndex);
});
