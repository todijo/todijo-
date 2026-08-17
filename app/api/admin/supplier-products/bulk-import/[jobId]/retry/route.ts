import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";
import { readSession } from "@/lib/session";
import { retryCatalogImportItems } from "@/lib/suppliers/supplier-catalog-jobs";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){try{assertAdminMutationRequest(request);const admin=await requirePlatformSupplierAdmin(prisma,await readSession()),{jobId}=await params,body=await request.json().catch(()=>({})) as {itemIds?:unknown;canonicalCategoryId?:unknown};return NextResponse.json({ok:true,...await retryCatalogImportItems(prisma,{adminId:admin.id,jobId,itemIds:body.itemIds,canonicalCategoryId:body.canonicalCategoryId})});}catch(error){if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_RETRY_FAILED";return NextResponse.json({error:code},{status:code.includes("NOT_FOUND")?404:code.includes("CATEGORY")?400:502});}}
