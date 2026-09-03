import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CatalogPreviewQueue, type CatalogPreviewSnapshot } from "../lib/suppliers/catalog-preview-queue";
import { catalogJobProgress, type CatalogJobProgressInput } from "../lib/suppliers/catalog-job-progress";
import { recoverStaleCatalogClaims, STALE_CLAIM_MS } from "../lib/suppliers/supplier-catalog-jobs";

type Preview={supplierProductId:string;errorCode:string|null};
const preview=(supplierProductId:string,errorCode:string|null=null):Preview=>({supplierProductId,errorCode});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason?:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};}

test("the client preview queue never re-previews completed identifiers and appends new selections",async()=>{
  const calls:string[][]=[],requests:Array<ReturnType<typeof deferred<Preview[]>>>=[];let latest:CatalogPreviewSnapshot<Preview>|null=null;
  const queue=new CatalogPreviewQueue<Preview>((ids)=>{calls.push(ids);const request=deferred<Preview[]>();requests.push(request);return request.promise},item=>item.supplierProductId,item=>Boolean(item.errorCode),snapshot=>{latest=snapshot},8,1_000);
  queue.updateSelection(["item-1"]);await tick();assert.deepEqual(calls,[["item-1"]]);queue.updateSelection(["item-1","item-2"]);await tick();assert.equal(calls.length,1);
  requests[0].resolve([preview("item-1")]);await tick();assert.deepEqual(calls,[["item-1"],["item-2"]]);requests[1].resolve([preview("item-2")]);await tick();
  assert.equal(latest!.completedCount,2);assert.deepEqual(Object.keys(latest!.results).sort(),["item-1","item-2"]);
});

test("large selections run sequential chunks and publish each completed chunk incrementally",async()=>{
  const calls:string[][]=[],requests:Array<ReturnType<typeof deferred<Preview[]>>>=[],snapshots:Array<CatalogPreviewSnapshot<Preview>>=[];
  const queue=new CatalogPreviewQueue<Preview>((ids)=>{calls.push(ids);const request=deferred<Preview[]>();requests.push(request);return request.promise},item=>item.supplierProductId,item=>Boolean(item.errorCode),snapshot=>snapshots.push(snapshot),8,1_000);
  const ids=Array.from({length:20},(_,index)=>`item-${index+1}`);queue.updateSelection(ids);await tick();assert.equal(calls.length,1);assert.equal(calls[0].length,8);
  requests[0].resolve(calls[0].map(id=>preview(id)));await tick();assert.equal(calls.length,2);assert.equal(snapshots.at(-1)!.completedCount,8);
  requests[1].resolve(calls[1].map(id=>preview(id)));await tick();assert.equal(calls.length,3);assert.equal(calls[2].length,4);assert.equal(snapshots.at(-1)!.completedCount,16);
  requests[2].resolve(calls[2].map(id=>preview(id)));await tick();assert.equal(snapshots.at(-1)!.completedCount,20);
});

test("watchdog and server lookup failures preserve earlier results and permit explicit retry",async()=>{
  let attempt=0,latest:CatalogPreviewSnapshot<Preview>|null=null;
  const queue=new CatalogPreviewQueue<Preview>((ids,signal)=>{attempt+=1;if(attempt===1)return Promise.resolve(ids.map(id=>preview(id,id==="item-2"?"CJ_UNAVAILABLE":null)));if(attempt===2)return new Promise<Preview[]>((_,reject)=>signal.addEventListener("abort",()=>reject(new Error("timeout")),{once:true}));return Promise.resolve(ids.map(id=>preview(id)));},item=>item.supplierProductId,item=>Boolean(item.errorCode),snapshot=>{latest=snapshot},1,10);
  queue.updateSelection(["item-1","item-2","item-3"]);await new Promise(resolve=>setTimeout(resolve,30));
  assert.ok(latest!.results["item-1"]);assert.equal(latest!.states["item-2"],"failed");assert.ok(latest!.results["item-3"]);
  queue.retry("item-2");await tick();await tick();assert.equal(latest!.completedCount,3);assert.equal(Object.keys(latest!.states).length,0);
});

test("elapsed time advances only for authoritative active claims",()=>{
  const base:CatalogJobProgressInput={status:"RUNNING",requestedCount:35,processedCount:24,importedCount:20,skippedCount:2,quarantinedCount:2,failedCount:0,createdAt:"2026-09-03T10:00:00Z",startedAt:"2026-09-03T10:00:00Z",updatedAt:"2026-09-03T10:00:45Z",completedAt:null,isProcessing:false};
  assert.equal(catalogJobProgress(base,Date.parse("2026-09-04T10:00:00Z")).elapsedSeconds,45);
  assert.equal(catalogJobProgress({...base,isProcessing:true},Date.parse("2026-09-03T10:01:00Z")).elapsedSeconds,60);
  const completed={...base,status:"COMPLETED",completedAt:"2026-09-03T10:00:50Z"};assert.equal(catalogJobProgress(completed,Date.parse("2026-09-05T10:00:00Z")).elapsedSeconds,50);
  assert.equal(catalogJobProgress({...base,startedAt:null}).elapsedSeconds,null);
});

test("stale importing leases return only interrupted work to resumable state",async()=>{
  const now=new Date("2026-09-03T12:00:00Z"),updates:unknown[]=[],jobUpdates:unknown[]=[];
  const db={supplierCatalogImportItem:{findMany:async()=>[{id:"stale-item",jobId:"job-1"}],updateMany:async(args:unknown)=>{updates.push(args);return{count:1}},groupBy:async()=>[{status:"PENDING",_count:{_all:11}},{status:"IMPORTED",_count:{_all:20}},{status:"SKIPPED",_count:{_all:2}},{status:"QUARANTINED",_count:{_all:2}}]},supplierCatalogImportJob:{update:async(args:unknown)=>{jobUpdates.push(args);return{}}}} as never;
  const boundary=new Date("2026-09-03T10:00:45Z");assert.deepEqual(await recoverStaleCatalogClaims(db,["job-1"],now,new Map([["job-1",boundary]])),["job-1"]);assert.equal(updates.length,1);assert.equal(jobUpdates.length,1);assert.equal((jobUpdates[0] as {data:{updatedAt:Date}}).data.updatedAt,boundary);
  const source=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8");assert.match(source,/status:"IMPORTING",claimedAt:\{lt:staleBefore\}/);assert.match(source,/data:\{status:"PENDING",claimedAt:null,errorCode:"INTERRUPTED_ITEM_RESUMED"/);assert.match(source,/status:pending\?"PENDING"/);assert.match(source,/where:\{id:candidate\.id,status:"PENDING"\}/);assert.match(source,/supplierProductLink\.findUnique/);assert.equal(STALE_CLAIM_MS,15*60_000);
});

test("preview and import safety contracts remain authoritative",()=>{
  const route=readFileSync("app/api/admin/supplier-products/catalog-preview/route.ts","utf8"),limiter=readFileSync("lib/suppliers/cj-rate-limiter.ts","utf8"),jobs=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),importer=readFileSync("lib/suppliers/supplier-products.ts","utf8");
  assert.match(route,/PREVIEW_CONCURRENCY=4/);assert.match(route,/scheduleCjRequest\("read",\(\)=>fetch/);assert.doesNotMatch(route,/Promise\.all\(identifiers/);assert.match(limiter,/DEFAULT_READ_INTERVAL_MS=1050/);assert.match(jobs,/CATALOG_IMPORT_CONCURRENCY=4/);assert.match(importer,/status:"DRAFT"/);assert.doesNotMatch(jobs,/status:\s*"PUBLISHED"/);
});
