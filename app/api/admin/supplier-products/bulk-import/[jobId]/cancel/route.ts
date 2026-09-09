import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";
import { readSession } from "@/lib/session";
import { cancelCatalogImportJob } from "@/lib/suppliers/supplier-catalog-jobs";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    assertAdminMutationRequest(request);
    const admin=await requirePlatformSupplierAdmin(prisma,await readSession()),{jobId}=await params;
    return NextResponse.json({ok:true,job:await cancelCatalogImportJob(prisma,{adminId:admin.id,jobId})});
  }catch(error){
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_JOB_CANCEL_FAILED";
    return NextResponse.json({error:code},{status:code.includes("NOT_FOUND")?404:code.includes("NOT_CANCELLABLE")?409:502});
  }
}
