import { canContinueCatalogJob, catalogJobProgress, type CatalogJobProgressInput } from "./catalog-job-progress";

export type CatalogAutoRunState="STARTING"|"BATCH_RUNNING"|"RECONCILING"|"CONTINUING"|"COMPLETE"|"BLOCKED";
export type CatalogAutoRunJob=CatalogJobProgressInput&{id:string;processingCount?:number;canContinue?:boolean};
type AutoRunDependencies<T extends CatalogAutoRunJob>={
  loadJob:(jobId:string)=>Promise<T>;
  resumeBatch:(jobId:string)=>Promise<void>;
  onState?:(state:CatalogAutoRunState,event:{jobId:string;job?:T;attempt?:number})=>void;
  delay?:(milliseconds:number)=>Promise<void>;
  reconciliationAttempts?:number;
  reconciliationDelayMs?:number;
};

function remaining(job:CatalogAutoRunJob){return catalogJobProgress(job).remaining;}
function resumable(job:CatalogAutoRunJob){return job.canContinue===true||canContinueCatalogJob(job);}

export async function runCatalogJobBatches<T extends CatalogAutoRunJob>(jobId:string,automatic:boolean,dependencies:AutoRunDependencies<T>){
  const delay=dependencies.delay??(milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds))),attempts=Math.max(1,Math.min(10,dependencies.reconciliationAttempts??6)),delayMs=Math.max(50,Math.min(1000,dependencies.reconciliationDelayMs??250));
  const transition=(state:CatalogAutoRunState,job?:T,attempt?:number)=>{console.info("[cj-catalog-auto-run]",JSON.stringify({event:"state",jobId,state,attempt,processedCount:job?.processedCount,requestedCount:job?.requestedCount,processingCount:job?.processingCount,status:job?.status}));dependencies.onState?.(state,{jobId,job,attempt});};
  async function reconcile(initial?:T){transition("RECONCILING",initial,0);let job=initial;for(let attempt=1;attempt<=attempts;attempt++){if(!job||attempt>1){if(attempt>1)await delay(delayMs);job=await dependencies.loadJob(jobId);}transition("RECONCILING",job,attempt);if(remaining(job)===0)return job;if(resumable(job))return job;}transition("BLOCKED",job,attempts);throw new Error("SUPPLIER_CATALOG_JOB_BUSY");}
  transition("STARTING");let job=await reconcile();
  for(;;){if(remaining(job)===0){transition("COMPLETE",job);return job;}if(!resumable(job))job=await reconcile(job);const before=job.processedCount;transition("BATCH_RUNNING",job);await dependencies.resumeBatch(jobId);job=await reconcile();if(job.processedCount<=before&&remaining(job)>0){transition("BLOCKED",job);throw new Error("SUPPLIER_CATALOG_JOB_STALLED");}if(!automatic){transition(remaining(job)===0?"COMPLETE":"BLOCKED",job);return job;}transition("CONTINUING",job);}
}
