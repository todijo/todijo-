import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError } from "@/lib/admin-access";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { calculateSupplierSnapshotPrices, SupplierPricingError } from "@/lib/suppliers/pricing";

export async function POST(request:Request){
  try{
    const session=await readSession();
    const admin=await requirePlatformSupplierAdmin(prisma,session);
    const body=await request.json() as {supplierProductId?:unknown};
    const store=await prisma.store.findUnique({where:{ownerId:admin.id},select:{currency:true}});
    if(!store)return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const snapshot=await new CjCatalogProvider().getProduct(String(body.supplierProductId??""));
    return NextResponse.json({ok:true,pricing:calculateSupplierSnapshotPrices(snapshot,store.currency)});
  }catch(error){
    if(error instanceof AdminAccessError)return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof SupplierPricingError?error.code:error instanceof Error?error.message:"SUPPLIER_PRICING_FAILED";
    return NextResponse.json({error:code},{status:400});
  }
}
