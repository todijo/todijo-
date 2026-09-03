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
    const job=await processCatalogImportJob(prisma,new CjCatalogProvider(),jobId,{adminId:admin.id,limit:body.limit});
    return NextResponse.json({ok:true,job,batches:1});
  }catch(error){
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_JOB_FAILED";
    return NextResponse.json({error:code},{status:code.includes("NOT_FOUND")?404:code==="SUPPLIER_CATALOG_JOB_BUSY"?409:502});
  }
}
