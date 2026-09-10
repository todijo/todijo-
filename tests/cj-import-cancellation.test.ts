import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cancelCatalogImportJob, createCatalogImportJob, listCatalogImportJobs, processCatalogImportJob, STALE_CLAIM_MS } from "../lib/suppliers/supplier-catalog-jobs";
import { canContinueCatalogJob } from "../lib/suppliers/catalog-job-progress";
import type { SupplierCatalogProvider, SupplierProductSnapshot } from "../lib/suppliers/types";

function summary(id:string,status="RUNNING"):{id:string;status:string;requestedCount:number;processedCount:number;importedCount:number;skippedCount:number;quarantinedCount:number;failedCount:number;batchLimit:number;destinationCountry:string;createdAt:Date;startedAt:Date;updatedAt:Date;completedAt:Date|null}{return{id,status,requestedCount:13,processedCount:10,importedCount:8,skippedCount:0,quarantinedCount:2,failedCount:0,batchLimit:10,destinationCountry:"FR",createdAt:new Date(0),startedAt:new Date(0),updatedAt:new Date(0),completedAt:null};}

test("cancelling one stuck import is terminal and preserves imported, review, draft, and other-job data",async()=>{
  const jobs=new Map([["stuck",summary("stuck")],["other",summary("other","PENDING")]]),items=[{jobId:"stuck",status:"IMPORTED",productId:"product-1"},{jobId:"stuck",status:"QUARANTINED",productId:null},{jobId:"stuck",status:"PENDING",productId:null},{jobId:"other",status:"PENDING",productId:null}],products=[{id:"product-1",status:"DRAFT"}];
  const db={supplierCatalogImportJob:{findFirst:async({where}:{where:{id:string;createdById:string}})=>where.createdById==="admin"?jobs.get(where.id)??null:null,updateMany:async({where,data}:{where:{id:string;status:{in:string[]}};data:Record<string,unknown>})=>{const job=jobs.get(where.id);if(!job||!where.status.in.includes(job.status))return{count:0};jobs.set(where.id,{...job,...data,status:String(data.status),completedAt:data.completedAt as Date});return{count:1}},findUniqueOrThrow:async({where}:{where:{id:string}})=>jobs.get(where.id)!}} as never;
  const beforeItems=structuredClone(items),beforeProducts=structuredClone(products),otherBefore=structuredClone(jobs.get("other"));
  const cancelled=await cancelCatalogImportJob(db,{adminId:"admin",jobId:"stuck"},new Date("2026-09-09T12:00:00Z"));
  assert.equal(cancelled.status,"CANCELLED");assert.equal(cancelled.importedCount,8);assert.equal(cancelled.quarantinedCount,2);assert.deepEqual(items,beforeItems);assert.deepEqual(products,beforeProducts);assert.deepEqual(jobs.get("other"),otherBefore);assert.equal(canContinueCatalogJob({...cancelled,isProcessing:false}),false);
  assert.equal((await cancelCatalogImportJob(db,{adminId:"admin",jobId:"stuck"})).status,"CANCELLED");
});

test("a completely new import can be created after cancellation",async()=>{
  let created:unknown;
  const db={supplierCatalogImportJob:{create:async({data}:{data:unknown})=>{created=data;return summary("new","PENDING")}}} as never;
  const job=await createCatalogImportJob(db,{adminId:"admin",storeId:"store",identifiers:["CJ-NEW-1000"],destinationCountry:"FR"});
  assert.equal(job.id,"new");assert.ok(created);
});

test("stale claims are classified without misclassifying a healthy active claim",async()=>{
  const jobs=[summary("stale"),summary("healthy")],now=Date.now();jobs[0].updatedAt=new Date(now-STALE_CLAIM_MS-60_000);jobs[1].updatedAt=new Date(now-60_000);
  const db={supplierCatalogImportJob:{findMany:async()=>jobs},supplierCatalogImportItem:{groupBy:async({where}:{where:{claimedAt?:unknown}})=>where.claimedAt?[{jobId:"stale",_count:{_all:1}}]:[{jobId:"stale",_count:{_all:1}},{jobId:"healthy",_count:{_all:1}}]}} as never;
  const listed=await listCatalogImportJobs(db,"admin"),stale=listed.find(job=>job.id==="stale")!,healthy=listed.find(job=>job.id==="healthy")!;
  assert.equal(stale.isStale,true);assert.equal(stale.isProcessing,false);assert.equal(healthy.isStale,false);assert.equal(healthy.isProcessing,true);
});

test("cancel route and UI require confirmation and cannot expose continuation for cancelled jobs",()=>{
  const source=readFileSync("lib/suppliers/supplier-catalog-jobs.ts","utf8"),ui=readFileSync("components/SupplierCatalogWorkspace.tsx","utf8"),migration=readFileSync("prisma/migrations/20260909140000_add_supplier_catalog_job_cancelled/migration.sql","utf8");
  assert.match(source,/status:\{not:"CANCELLED"\}/);assert.match(source,/updatedAt:job\.updatedAt,status:\{in:\["PENDING","RUNNING"\]\}/);assert.match(ui,/window\.confirm\(t\("cancelConfirm"\)\)/);assert.match(ui,/job\.status!=="CANCELLED"&&progress\.remaining>0/);assert.match(migration,/ADD VALUE IF NOT EXISTS 'CANCELLED'/);assert.doesNotMatch(source,/product\.delete|deleteMany/);
});

function existingSnapshot(identifier:string):SupplierProductSnapshot{return{provider:"CJ",supplierProductId:identifier,sku:identifier,title:"Existing product",description:"Existing product",categoryReference:null,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:100,variants:[],media:[],rawMetadata:{}};}

test("a new six-item job claims its first batch and advances processedCount from zero",async()=>{
  const ids=Array.from({length:6},(_,index)=>`CJ-NEW-${index+1000}`),states=new Map(ids.map(id=>[id,"PENDING"])),updatedAt=new Date("2026-09-11T08:00:00Z");let jobStatus="PENDING",processedCount=0,claims=0;
  const db={supplierCatalogImportJob:{findFirst:async()=>({id:"new-six",storeId:"store",status:jobStatus,destinationCountry:"FR",batchLimit:10,startedAt:null,updatedAt,store:{currency:"USD"}}),updateMany:async({where,data}:{where:{status:{in?:string[];not?:string}};data:Record<string,unknown>})=>{if(where.status.in&&!where.status.in.includes(jobStatus))return{count:0};if(where.status.not&&where.status.not===jobStatus)return{count:0};jobStatus=String(data.status);const processed=data.processedCount as {set?:number}|undefined;if(processed?.set!=null)processedCount=processed.set;return{count:1}},findUniqueOrThrow:async()=>({...summary("new-six",jobStatus),requestedCount:6,processedCount})},supplierCatalogImportItem:{findMany:async({where}:{where:{claimedAt?:unknown;status:string}})=>where.claimedAt?[]:ids.filter(id=>states.get(id)==="PENDING").map(id=>({id,requestedIdentifier:id,canonicalCategoryId:null})),count:async({where}:{where:{status:string}})=>[...states.values()].filter(status=>status===where.status).length,updateMany:async({where,data}:{where:{id:string;status:string};data:{status:string}})=>{if(states.get(where.id)!==where.status)return{count:0};states.set(where.id,data.status);claims+=1;return{count:1}},update:async({where,data}:{where:{id:string};data:{status:string}})=>{states.set(where.id,data.status);return{}},groupBy:async()=>[{status:"SKIPPED",_count:{_all:6}}]},supplierProductLink:{findUnique:async({where}:{where:{connectionId_supplierProductId:{supplierProductId:string}}})=>({productId:`product-${where.connectionId_supplierProductId.supplierProductId}`})}} as never;
  const provider:SupplierCatalogProvider={id:"CJ",isConfigured:()=>true,getProduct:async identifier=>existingSnapshot(identifier)};
  const result=await processCatalogImportJob(db,provider,"new-six",{adminId:"admin"},{media:{} as never});
  assert.equal(claims,6);assert.ok([...states.values()].every(status=>status==="SKIPPED"));assert.equal(result.processedCount,6);assert.equal(processedCount,6);
});

test("a CANCELLED job cannot start processing or claim a pending item",async()=>{
  let claims=0;
  const db={supplierCatalogImportJob:{findFirst:async()=>({id:"cancelled",storeId:"store",status:"CANCELLED",destinationCountry:"FR",batchLimit:10,startedAt:new Date(),updatedAt:new Date(),store:{currency:"USD"}}),updateMany:async()=>({count:0})},supplierCatalogImportItem:{findMany:async()=>[],count:async()=>0,updateMany:async()=>{claims+=1;return{count:1}}}} as never;
  const provider:SupplierCatalogProvider={id:"CJ",isConfigured:()=>true,getProduct:async identifier=>existingSnapshot(identifier)};
  await assert.rejects(()=>processCatalogImportJob(db,provider,"cancelled",{adminId:"admin"}),/SUPPLIER_CATALOG_JOB_BUSY/);assert.equal(claims,0);
});
