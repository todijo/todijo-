import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const classifier=readFileSync(new URL("../lib/suppliers/cj-taxonomy-classifier.ts",import.meta.url),"utf8");
const preview=readFileSync(new URL("../app/api/admin/supplier-products/catalog-preview/route.ts",import.meta.url),"utf8");

test("CJ preview classifies by stable taxonomy ID before legacy fallback",()=>{
  assert.match(classifier,/getCjCategoryTaxonomySnapshot/);
  assert.match(classifier,/resolveCjCategoryIdMapping/);
  assert.match(classifier,/CJ_TAXONOMY_ID_MAPPING/);
  assert.match(classifier,/return classifyCjProductAuthoritatively\(snapshot\)/);
  assert.match(preview,/classifyCjProductByTaxonomyId/);
  assert.doesNotMatch(preview,/classifyCjProductAuthoritatively/);
});
