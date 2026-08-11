import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { defaultSupplierMediaProvider, importSupplierProduct } from "@/lib/suppliers/supplier-products";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { AdminAccessError } from "@/lib/admin-access";

export async function POST(request: Request) {
  const session = await readSession();
    const admin = await requirePlatformSupplierAdmin(prisma, session);
  try {
    const body = await request.json() as {supplierProductId?:unknown;sellingPrice?:unknown;category?:unknown};
    const store = await prisma.store.findUnique({where:{ownerId:admin.id},select:{id:true}});
    if (!store) return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const product = await importSupplierProduct(prisma,new CjCatalogProvider(),defaultSupplierMediaProvider(),{storeId:store.id,supplierProductId:String(body.supplierProductId??""),sellingPrice:Number(body.sellingPrice),category:String(body.category??"Other")});
    return NextResponse.json({ok:true,productId:product.id,status:"DRAFT"},{status:201});
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:error.status});
    const code=error instanceof Error?error.message:"SUPPLIER_IMPORT_FAILED";
    const status=code==="SUPPLIER_NOT_CONFIGURED"||code==="CJ_NOT_CONFIGURED"?503:code==="SUPPLIER_PRODUCT_ALREADY_IMPORTED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
