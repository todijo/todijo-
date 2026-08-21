import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const jobs=readFileSync(resolve(process.cwd(),"lib/suppliers/supplier-catalog-jobs.ts"),"utf8");

test("durable CJ import uses the same taxonomy-ID classifier as preview",()=>{
  assert.match(jobs,/classifyCjProductByTaxonomyId/);
  assert.doesNotMatch(jobs,/classifyCjProductAuthoritatively/);
  assert.match(jobs,/CJ_TAXONOMY_ID_MAPPING:/);
  assert.match(jobs,/CJ_CATEGORY_ID_AUTHORITATIVE_MAPPING/);
});
