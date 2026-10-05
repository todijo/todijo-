import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locales } from "../i18n/config";
import { supplierBulkMessages } from "../i18n/supplier-bulk";
import { canContinueCatalogJob, catalogJobProgress, type CatalogJobProgressInput } from "../lib/suppliers/catalog-job-progress";
import { CATALOG_IMPORT_JOBS_PAGE_SIZE, listCatalogImportJobsPage, readCatalogImportJob } from "../lib/suppliers/supplier-catalog-jobs";

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

test("read-only job progress reflects item completion before a batch finishes",async()=>{
  let groups=[{status:"IMPORTED",_count:{_all:1}},{status:"SKIPPED",_count:{_all:1}},{status:"IMPORTING",_count:{_all:1}},{status:"PENDING",_count:{_all:2}}],writes=0;
  const db={supplierCatalogImportJob:{findFirst:async()=>({id:"live-job",status:"RUNNING",requestedCount:5,processedCount:0,importedCount:0,skippedCount:0,quarantinedCount:0,failedCount:0,batchLimit:10,destinationCountry:"FR",createdAt:new Date(0),startedAt:new Date(0),updatedAt:new Date(0),completedAt:null})},supplierCatalogImportItem:{groupBy:async()=>groups,count:async({where}:{where:{claimedAt?:unknown}})=>where.claimedAt?0:groups.find(group=>group.status==="IMPORTING")?._count._all??0},$executeRaw:async()=>{writes++;return 0;}} as never;
  const first=await readCatalogImportJob(db,{adminId:"admin",jobId:"live-job",includeItems:false});
  assert.deepEqual({processed:first.processedCount,imported:first.importedCount,skipped:first.skippedCount,remaining:first.remainingCount,processing:first.processingCount},{processed:2,imported:1,skipped:1,remaining:3,processing:1});
  groups=[{status:"IMPORTED",_count:{_all:2}},{status:"SKIPPED",_count:{_all:1}},{status:"FAILED",_count:{_all:1}},{status:"PENDING",_count:{_all:1}}];
  const next=await readCatalogImportJob(db,{adminId:"admin",jobId:"live-job",includeItems:false});
  assert.deepEqual({processed:next.processedCount,imported:next.importedCount,skipped:next.skippedCount,failed:next.failedCount,remaining:next.remainingCount,processing:next.processingCount},{processed:4,imported:2,skipped:1,failed:1,remaining:1,processing:0});
  assert.equal("items" in first,false);assert.equal(writes,0);
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

test("active progress refresh uses lightweight no-store snapshots and avoids overlapping loads",()=>{
  const workspace=readFileSync("components/SupplierCatalogWorkspace.tsx","utf8"),route=readFileSync("app/api/admin/supplier-products/bulk-import/[jobId]/route.ts","utf8");
  assert.match(workspace,/pendingJobLoadsRef/);assert.match(workspace,/setInterval\(poll,1000\)/);assert.match(workspace,/\?progress=1/);assert.match(workspace,/jobsRef\.current\.filter\(job=>job\.isProcessing\)/);
  assert.match(route,/searchParams\.get\("progress"\)!=="1"/);assert.match(route,/Cache-Control":"private, no-store"/);
});

test("import history pagination reads only the requested bounded page without deleting history",async()=>{
  let query:any;
  const row=(id:string)=>({id,status:"COMPLETED",requestedCount:1,processedCount:1,importedCount:1,skippedCount:0,quarantinedCount:0,failedCount:0,batchLimit:10,destinationCountry:"FR",createdAt:new Date(0),startedAt:new Date(0),updatedAt:new Date(0),completedAt:new Date(0)});
  const db={supplierCatalogImportJob:{count:async()=>23,findMany:async(args:any)=>{query=args;return [row("job-21"),row("job-22"),row("job-23")];}},supplierCatalogImportItem:{groupBy:async()=>[]}} as never;
  const result=await listCatalogImportJobsPage(db,"admin",3);
  assert.equal(CATALOG_IMPORT_JOBS_PAGE_SIZE,10);assert.deepEqual({page:result.page,pageCount:result.pageCount,total:result.total,jobs:result.jobs.length},{page:3,pageCount:3,total:23,jobs:3});
  assert.equal(query.skip,20);assert.equal(query.take,10);assert.equal(query.where.createdById,"admin");
  const workspace=readFileSync("components/SupplierCatalogWorkspace.tsx","utf8");
  assert.match(workspace,/scrollIntoView\(\{behavior:"smooth",block:"center"\}\)/);assert.match(workspace,/id=\{`supplier-job-\$\{job\.id\}`\}/);assert.match(workspace,/href=\{`\?page=/);assert.doesNotMatch(workspace,/scrollTo\(0,document\.body\.scrollHeight\)|footer\.scrollIntoView/);
});
