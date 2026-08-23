import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { processCatalogImportJob } from "@/lib/suppliers/supplier-catalog-jobs";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    assertAdminMutationRequest(request);
    const admin=await requirePlatformSupplierAdmin(prisma,await readSession()),{jobId}=await params,body=await request.json().catch(()=>({})) as {limit?:unknown};
    const provider=new CjCatalogProvider();
    let job=await processCatalogImportJob(prisma,provider,jobId,{adminId:admin.id,limit:body.limit});
    let batches=1;
    while(job.status==="RUNNING"&&job.processedCount<job.requestedCount){
      const before=job.processedCount;
      job=await processCatalogImportJob(prisma,provider,jobId,{adminId:admin.id,limit:body.limit});
      batches+=1;
      if(job.processedCount<=before)throw new Error("SUPPLIER_CATALOG_JOB_STALLED");
      if(batches>job.requestedCount+1)throw new Error("SUPPLIER_CATALOG_JOB_STALLED");
    }
    return NextResponse.json({ok:true,job,batches});
  }catch(error){
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_JOB_FAILED";
    return NextResponse.json({error:code},{status:code.includes("NOT_FOUND")?404:502});
  }
}
