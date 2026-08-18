import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";
import { readSession } from "@/lib/session";
import { createCatalogImportJob, MAX_CATALOG_JOB_ITEMS } from "@/lib/suppliers/supplier-catalog-jobs";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function GET(){try{const admin=await requirePlatformSupplierAdmin(prisma,await readSession());const jobs=await prisma.supplierCatalogImportJob.findMany({where:{createdById:admin.id},orderBy:{createdAt:"desc"},take:20,select:{id:true,status:true,requestedCount:true,processedCount:true,importedCount:true,skippedCount:true,quarantinedCount:true,failedCount:true,batchLimit:true,destinationCountry:true,createdAt:true,updatedAt:true}});return NextResponse.json({ok:true,jobs});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});return NextResponse.json({error:"SUPPLIER_CATALOG_JOBS_FAILED"},{status:502});}}

export async function POST(request:Request){
  try{
    assertAdminMutationRequest(request);
    const session=await readSession(),admin=await requirePlatformSupplierAdmin(prisma,session),body=await request.json().catch(()=>({})) as Record<string,unknown>;
    const store=await prisma.store.findUnique({where:{ownerId:admin.id},select:{id:true}});if(!store)return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const canonicalCategoryByIdentifier=typeof body.canonicalCategoryByIdentifier==="object"&&body.canonicalCategoryByIdentifier!==null&&!Array.isArray(body.canonicalCategoryByIdentifier)?body.canonicalCategoryByIdentifier as Record<string,string>:undefined;
    const job=await createCatalogImportJob(prisma,{adminId:admin.id,storeId:store.id,identifiers:body.identifiers,destinationCountry:body.destinationCountry,canonicalCategoryId:typeof body.canonicalCategoryId==="string"?body.canonicalCategoryId:null,canonicalCategoryByIdentifier,batchLimit:body.batchLimit});
    return NextResponse.json({ok:true,maximum:MAX_CATALOG_JOB_ITEMS,job},{status:201});
  }catch(error){
    if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_BULK_IMPORT_FAILED",status=code.includes("LIMIT")?400:code.includes("INPUT")||code.includes("CATEGORY")||code.includes("COUNTRY")?400:502;
    return NextResponse.json({error:code},{status});
  }
}
