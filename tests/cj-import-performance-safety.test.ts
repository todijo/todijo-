import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CATALOG_IMPORT_CONCURRENCY,DEFAULT_CATALOG_PROCESS_LIMIT,MAX_CATALOG_PROCESS_LIMIT,runCatalogWorkBounded} from "../lib/suppliers/supplier-catalog-jobs";

const read=(path:string)=>readFileSync(path,"utf8");

test("CJ bulk import uses larger bounded batches and parallel product work",async()=>{
  assert.equal(DEFAULT_CATALOG_PROCESS_LIMIT,10);
  assert.equal(MAX_CATALOG_PROCESS_LIMIT,25);
  assert.equal(CATALOG_IMPORT_CONCURRENCY,4);
  const items=[1,2,3,4,5,6,7,8],latency=30;
  let active=0,peak=0;
  const started=Date.now();
  await runCatalogWorkBounded(items,async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,latency));active--;});
  const elapsed=Date.now()-started;
  assert.equal(peak,4);
  assert.ok(elapsed<latency*4,`bounded parallel benchmark elapsed=${elapsed}`);
});

test("CJ preview is bounded-parallel instead of serial per selected product",()=>{
  const preview=read("app/api/admin/supplier-products/catalog-preview/route.ts");
  assert.match(preview,/PREVIEW_CONCURRENCY=4/);
  assert.match(preview,/mapPreviewBounded\(identifiers/);
  assert.match(preview,/Promise\.all/);
  assert.doesNotMatch(preview,/for\(const identifier of identifiers\)/);
});

test("catalog reference pricing stops after the first usable variant but live buyer pricing stays authoritative",()=>{
  const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),commerce=read("lib/suppliers/commerce-pricing.ts"),checkout=read("lib/payments.ts");
  assert.match(jobs,/FIRST_PURCHASABLE_VARIANT_WITH_FREIGHT/);
  assert.match(jobs,/variantsProbed:attempts\.length/);
  assert.match(jobs,/best=\{variant,freight,calculation,presentment,fx\};\s*break;/);
  assert.match(commerce,/resolveCjFreightAcrossOrigins/);
  assert.match(commerce,/quantity:input\.quantity/);
  assert.match(checkout,/resolveDropshippingPricing/);
});

test("bulk import defers nonessential CJ review hydration without losing later review sync",()=>{
  const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),products=read("lib/suppliers/supplier-products.ts");
  assert.match(jobs,/syncReviews:false/);
  assert.match(products,/syncReviews\?:boolean/);
  assert.match(products,/input\.syncReviews!==false&&provider\.getProductReviews/);
  const syncOnly=products.slice(products.indexOf("export async function syncSupplierProduct"));
  assert.match(syncOnly,/syncSupplierReviews/);
});

test("large CJ jobs use one server batch per request and client continuation",()=>{
  const route=read("app/api/admin/supplier-products/bulk-import/[jobId]/resume/route.ts"),workspace=read("components/SupplierCatalogWorkspace.tsx");
  assert.match(route,/batches:1/);
  assert.doesNotMatch(route,/while\(job\.status/);
  assert.doesNotMatch(workspace,/while\(job\.processedCount<job\.requestedCount/);
  assert.doesNotMatch(workspace,/maximumBatches/);
  assert.match(workspace,/disabled=\{busy\|\|!canContinue\}/);
  assert.match(workspace,/canContinueCatalogJob\(before\)/);
  assert.match(workspace,/SUPPLIER_CATALOG_JOB_STALLED/);
});

test("performance changes keep imports draft-only and fulfillment isolated",()=>{
  const products=read("lib/suppliers/supplier-products.ts"),jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),fulfillment=read("lib/suppliers/supplier-fulfillment.ts");
  assert.match(products,/status:"DRAFT"/);
  assert.doesNotMatch(jobs,/status:\s*"PUBLISHED"/);
  assert.doesNotMatch(jobs,/createOrder|payBalance|fulfillment/i);
  assert.match(fulfillment,/CJ_AUTOMATIC_FULFILLMENT_ENABLED/);
});
