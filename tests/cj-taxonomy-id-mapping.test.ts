import test from "node:test";
import assert from "node:assert/strict";
import { buildCjTaxonomyCoverageReport, deriveExactPathMappings, mergeCjCategoryIdMappings, resolveCjCategoryIdMapping, validateCjCategoryIdMappings } from "../lib/suppliers/cj-taxonomy-mapping";
import { buildCjTaxonomyMirror } from "../lib/suppliers/cj-taxonomy-sync";

test("CJ mappings are keyed by stable category id and curated rules override derived ones",()=>{
  const paths=[
    {categoryId:"CJ-HANDBAG",first:"Bags & Shoes",second:"Women's Bags",third:"Handbags"},
    {categoryId:"CJ-CAR-STICKER",first:"Automobiles & Motorcycles",second:"Exterior Accessories",third:"Stickers & Decals"},
  ];
  const derived=deriveExactPathMappings(paths);
  assert.equal(derived.length,2);
  const handbag=derived.find(row=>row.cjCategoryId==="CJ-HANDBAG");
  assert.ok(handbag?.canonicalCategoryId);
  const merged=mergeCjCategoryIdMappings([{cjCategoryId:"CJ-HANDBAG",canonicalCategoryId:handbag!.canonicalCategoryId,source:"CURATED"}],derived);
  assert.equal(resolveCjCategoryIdMapping("cj-handbag",merged)?.source,"CURATED");
});

test("coverage report is third-level only, deterministic, and exposes every unmapped CJ leaf",()=>{
  const paths=[
    {categoryId:"F1",first:"Consumer Electronics",second:"",third:""},
    {categoryId:"S1",first:"Consumer Electronics",second:"Portable Audio",third:""},
    {categoryId:"T1",first:"Consumer Electronics",second:"Portable Audio",third:"Speakers"},
    {categoryId:"T2",first:"Computer & Office",second:"Computer Peripherals",third:"Keyboards"},
  ];
  const nodes=buildCjTaxonomyMirror(paths);
  const report=buildCjTaxonomyCoverageReport(nodes,[]);
  assert.equal(report.totalThirdLevel,2);
  assert.equal(report.mapped,0);
  assert.equal(report.unmapped,2);
  assert.equal(report.unmappedRows.length,2);
  assert.deepEqual(report.unmappedRows.map(row=>row.cjCategoryId).sort(),["T1","T2"]);
});

test("invalid duplicate IDs and non-canonical Todijo targets fail closed",()=>{
  assert.throws(()=>validateCjCategoryIdMappings([
    {cjCategoryId:"X",canonicalCategoryId:"bad-target",source:"CURATED"},
  ]),/CJ_CATEGORY_MAPPING_TARGET_INVALID/);
  assert.throws(()=>validateCjCategoryIdMappings([
    {cjCategoryId:"X",canonicalCategoryId:"bad-target",source:"CURATED"},
    {cjCategoryId:"x",canonicalCategoryId:"bad-target",source:"CURATED"},
  ]));
});
