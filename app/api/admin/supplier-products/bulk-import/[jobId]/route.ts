import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { readCatalogImportJob } from "@/lib/suppliers/supplier-catalog-jobs";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function GET(request:Request,{params}:{params:Promise<{jobId:string}>}){try{const admin=await requirePlatformSupplierAdmin(prisma,await readSession()),{jobId}=await params,url=new URL(request.url);return NextResponse.json({ok:true,job:await readCatalogImportJob(prisma,{adminId:admin.id,jobId,cursor:url.searchParams.get("cursor"),take:url.searchParams.get("take")})});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_JOB_FAILED";return NextResponse.json({error:code},{status:code.includes("NOT_FOUND")?404:502});}}
