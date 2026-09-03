export type CatalogJobProgressInput={
  status:string;
  requestedCount:number;
  processedCount:number;
  importedCount:number;
  skippedCount:number;
  quarantinedCount:number;
  failedCount:number;
  createdAt:string|Date;
  startedAt?:string|Date|null;
  completedAt?:string|Date|null;
  isProcessing?:boolean;
};

function timestamp(value:string|Date|null|undefined){
  if(value==null)return null;
  const parsed=new Date(value).getTime();
  return Number.isFinite(parsed)?parsed:null;
}

export function catalogJobProgress(job:CatalogJobProgressInput,now=Date.now()){
  const total=Math.max(0,job.requestedCount),processed=Math.min(total,Math.max(0,job.processedCount));
  const remaining=Math.max(0,total-processed),percent=total===0?0:Math.min(100,Math.round(processed/total*100));
  const startedAt=timestamp(job.startedAt),terminal=job.status==="COMPLETED"||job.status==="COMPLETED_WITH_ERRORS",endedAt=terminal?timestamp(job.completedAt):now;
  const elapsedSeconds=startedAt!=null&&endedAt!=null&&endedAt>=startedAt?Math.floor((endedAt-startedAt)/1000):null;
  return{total,processed,remaining,percent,elapsedSeconds,imported:Math.max(0,job.importedCount),skipped:Math.max(0,job.skippedCount),quarantined:Math.max(0,job.quarantinedCount),failed:Math.max(0,job.failedCount)};
}

export function canContinueCatalogJob(job:CatalogJobProgressInput){
  const {remaining}=catalogJobProgress(job);
  return !job.isProcessing&&remaining>0&&(job.status==="PENDING"||job.status==="RUNNING");
}
