import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runCatalogJobBatches,type CatalogAutoRunJob,type CatalogAutoRunState} from "../lib/suppliers/catalog-job-auto-run";

const read=(path:string)=>readFileSync(path,"utf8");
function job(id:string,processedCount:number,requestedCount:number,overrides:Partial<CatalogAutoRunJob>={}):CatalogAutoRunJob{return{id,status:"PENDING",requestedCount,processedCount,importedCount:processedCount,skippedCount:0,quarantinedCount:0,failedCount:0,createdAt:new Date(0),updatedAt:new Date(0),processingCount:0,isProcessing:false,canContinue:processedCount<requestedCount,...overrides};}

async function autoRun(total:number,transientAfterFirst=false){
  const targetId=`new-${total}`,historical=job("old-24-of-35",24,35),calls:string[]=[],states:CatalogAutoRunState[]=[];let processed=0,active=0,peak=0,transient=0;
  const result=await runCatalogJobBatches(targetId,true,{loadJob:async id=>{calls.push(`GET:${id}`);assert.equal(historical.processedCount,24);if(transientAfterFirst&&processed===10&&transient++<2)return job(id,processed,total,{processingCount:1,isProcessing:true,canContinue:false});return job(id,processed,total);},resumeBatch:async id=>{calls.push(`POST:${id}`);active++;peak=Math.max(peak,active);processed=Math.min(total,processed+10);active--;},delay:async()=>undefined,onState:state=>states.push(state)});
  return{targetId,historical,calls,states,peak,result};
}

test("new 50 and 100 item jobs auto-run through sequential bounded batches",async()=>{for(const total of [50,100]){const run=await autoRun(total);assert.equal(run.result.processedCount,total);assert.equal(run.calls.filter(call=>call.startsWith("POST:")).length,total/10);assert.equal(run.peak,1);assert.ok(run.calls.every(call=>call.endsWith(run.targetId)));assert.equal(run.historical.processedCount,24);assert.deepEqual(new Set(run.states),new Set<CatalogAutoRunState>(["STARTING","RECONCILING","BATCH_RUNNING","CONTINUING","COMPLETE"]));}});

test("transient post-batch processing snapshot reconciles and continues",async()=>{const run=await autoRun(50,true);assert.equal(run.result.processedCount,50);assert.equal(run.calls.filter(call=>call.startsWith("POST:")).length,5);assert.ok(run.calls.filter(call=>call.startsWith("GET:")).length>6);});

test("a stale false continuation hint cannot override safely resumable exact-job fields",async()=>{let processed=0,posts=0;const result=await runCatalogJobBatches("new-50",true,{loadJob:async id=>job(id,processed,50,{processingCount:0,isProcessing:false,canContinue:false}),resumeBatch:async id=>{assert.equal(id,"new-50");posts++;processed+=10;},delay:async()=>undefined});assert.equal(result.processedCount,50);assert.equal(posts,5);});

test("historical job resume is manual, one batch, and exact-target only",async()=>{let processed=24;const calls:string[]=[];const result=await runCatalogJobBatches("old-24-of-35",false,{loadJob:async id=>{calls.push(`GET:${id}`);return job(id,processed,35);},resumeBatch:async id=>{calls.push(`POST:${id}`);processed=34;},delay:async()=>undefined});assert.equal(result.processedCount,34);assert.equal(calls.filter(call=>call.startsWith("POST:")).length,1);assert.ok(calls.every(call=>call.endsWith("old-24-of-35")));});

test("GET/list are read-only and stale recovery stays mutation target-scoped",()=>{const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),list=jobs.slice(jobs.indexOf("export async function listCatalogImportJobs"),jobs.indexOf("type CatalogPricingAttempt")),detail=jobs.slice(jobs.indexOf("export async function readCatalogImportJob"));assert.doesNotMatch(list,/recoverStaleCatalogClaims|\.update/);assert.doesNotMatch(detail,/recoverStaleCatalogClaims|\.update/);assert.match(jobs,/recoverStaleCatalogClaims\(db,\[jobId\]/);assert.match(jobs,/where:\{id:candidate\.id,status:"PENDING"\}/);});

test("new jobs auto-run while historical controls stay explicitly manual",()=>{const ui=read("components/SupplierCatalogWorkspace.tsx"),runner=read("lib/suppliers/catalog-job-auto-run.ts");assert.match(ui,/resume\(data\.job\.id,true\)/);assert.match(ui,/runCatalogJobBatches\(jobId,automatic/);assert.match(ui,/job\.id===jobId\?data\.job!:job/);assert.match(ui,/onClick=\{\(\)=>void resume\(job\.id\)\}/);assert.match(runner,/STARTING.*BATCH_RUNNING.*RECONCILING.*CONTINUING.*COMPLETE.*BLOCKED/);assert.match(runner,/\[cj-catalog-auto-run\]/);});

test("bounded import and safety invariants remain intact",()=>{const jobs=read("lib/suppliers/supplier-catalog-jobs.ts"),preview=read("app/api/admin/supplier-products/catalog-preview/route.ts"),importer=read("lib/suppliers/supplier-products.ts");assert.match(jobs,/CATALOG_IMPORT_CONCURRENCY=4/);assert.match(jobs,/take:limit/);assert.match(preview,/PREVIEW_CONCURRENCY=4/);assert.match(preview,/scheduleCjRequest\("read"/);assert.match(importer,/status:"DRAFT"/);assert.doesNotMatch(jobs,/status:\s*"PUBLISHED"/);});
