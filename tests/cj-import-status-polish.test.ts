import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locales } from "../i18n/config";
import { supplierBulkMessages } from "../i18n/supplier-bulk";
import { canContinueCatalogJob, catalogJobProgress, type CatalogJobProgressInput } from "../lib/suppliers/catalog-job-progress";

const base:CatalogJobProgressInput={status:"RUNNING",requestedCount:35,processedCount:24,importedCount:20,skippedCount:2,quarantinedCount:2,failedCount:0,createdAt:"2026-09-03T10:00:00.000Z",startedAt:"2026-09-03T10:00:00.000Z",completedAt:null,isProcessing:true};

test("all supported locales describe controlled bounded batches without stale sequential claims",()=>{
  const required=["bulkSafety","processedCount","remainingCount","elapsed","durationUnavailable","resumeBusy","jobStatusPending","jobStatusRunning","jobStatusReady","jobStatusCompleted","jobStatusReview"] as const;
  assert.equal(locales.length,14);
  for(const locale of locales){const messages=supplierBulkMessages[locale];assert.ok(messages,`missing ${locale}`);for(const key of required)assert.ok(messages[key]?.trim(),`${locale}.${key}`);assert.doesNotMatch(messages.bulkSafety!,/sequential|séquentiel|بە ڕیز/i);}
});

test("running elapsed time uses the persisted start and advances with the current clock",()=>{
  assert.equal(catalogJobProgress(base,Date.parse("2026-09-03T10:00:32.000Z")).elapsedSeconds,32);
  assert.equal(catalogJobProgress(base,Date.parse("2026-09-03T10:00:41.000Z")).elapsedSeconds,41);
  assert.equal(catalogJobProgress({...base,startedAt:null},Date.parse("2026-09-03T10:00:41.000Z")).elapsedSeconds,null);
});

test("completed duration is stable and progress counts remain mathematically correct",()=>{
  const completed={...base,status:"COMPLETED_WITH_ERRORS",isProcessing:false,completedAt:"2026-09-03T10:00:45.000Z"};
  const first=catalogJobProgress(completed,Date.parse("2026-09-03T11:00:00.000Z")),later=catalogJobProgress(completed,Date.parse("2026-09-04T11:00:00.000Z"));
  assert.equal(first.elapsedSeconds,45);assert.equal(later.elapsedSeconds,45);assert.deepEqual({total:first.total,processed:first.processed,remaining:first.remaining,imported:first.imported,skipped:first.skipped,quarantined:first.quarantined,failed:first.failed},{total:35,processed:24,remaining:11,imported:20,skipped:2,quarantined:2,failed:0});
});

test("continuation is eligible only between bounded batches with remaining work",()=>{
  assert.equal(canContinueCatalogJob(base),false);
  assert.equal(canContinueCatalogJob({...base,status:"PENDING",isProcessing:false}),true);
  assert.equal(canContinueCatalogJob({...base,status:"COMPLETED",processedCount:35,isProcessing:false}),false);
  const jobs=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),workspace=readFileSync("components/SupplierCatalogWorkspace.tsx","utf8"),resumeRoute=readFileSync("app/api/admin/supplier-products/bulk-import/[jobId]/resume/route.ts","utf8");
  assert.match(jobs,/status:pending\?"PENDING"/);assert.match(jobs,/updatedAt:job\.updatedAt,status:\{in:\["PENDING","RUNNING"\]\}/);assert.match(jobs,/SUPPLIER_CATALOG_JOB_BUSY/);assert.match(workspace,/if\(runningJobRef\.current\)return/);assert.match(workspace,/disabled=\{Boolean\(runningJobId\)\|\|!canContinue\}/);assert.match(resumeRoute,/SUPPLIER_CATALOG_JOB_BUSY"\?409/);
});

test("50 and 100 item jobs stay resumable through bounded server requests",()=>{
  const jobs=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),workspace=readFileSync("components/SupplierCatalogWorkspace.tsx","utf8"),preview=readFileSync("app/api/admin/supplier-products/catalog-preview/route.ts","utf8"),limiter=readFileSync("lib/suppliers/cj-rate-limiter.ts","utf8"),importer=readFileSync("lib/suppliers/supplier-products.ts","utf8");
  assert.match(jobs,/DEFAULT_CATALOG_PROCESS_LIMIT=10/);assert.match(jobs,/MAX_CATALOG_PROCESS_LIMIT=25/);assert.match(jobs,/take:limit/);assert.match(jobs,/CATALOG_IMPORT_CONCURRENCY=4/);assert.equal(Math.ceil(50/25),2);assert.equal(Math.ceil(100/25),4);assert.doesNotMatch(workspace,/while\(job\.processedCount/);assert.match(preview,/PREVIEW_CONCURRENCY=4/);assert.match(preview,/scheduleCjRequest\("read"/);assert.match(limiter,/DEFAULT_READ_INTERVAL_MS=1050/);assert.match(importer,/status:"DRAFT"/);assert.doesNotMatch(jobs,/status:\s*"PUBLISHED"/);
});
