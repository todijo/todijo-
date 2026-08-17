import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

export async function GET(request:Request){
  try{
    await requirePlatformSupplierAdmin(prisma,await readSession());const url=new URL(request.url),query=url.searchParams.get("q")??"",page=Number(url.searchParams.get("page")??1),pageSize=Number(url.searchParams.get("pageSize")??20),provider=new CjCatalogProvider();
    if(!provider.isConfigured())return NextResponse.json({error:"SUPPLIER_NOT_CONFIGURED"},{status:503});
    return NextResponse.json({ok:true,...await provider.searchProducts(query,page,pageSize)});
  }catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});const code=error instanceof Error?error.message:"SUPPLIER_CATALOG_SEARCH_FAILED";return NextResponse.json({error:code},{status:code.includes("INPUT")?400:502});}
}
