import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { defaultSupplierMediaProvider, importSupplierProduct } from "@/lib/suppliers/supplier-products";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session || !["SELLER","ADMIN"].includes(session.role)) return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:403});
  try {
    const body = await request.json() as {supplierProductId?:unknown;sellingPrice?:unknown;category?:unknown;storeId?:unknown};
    const store = session.role === "ADMIN" && typeof body.storeId === "string"
      ? await prisma.store.findUnique({where:{id:body.storeId},select:{id:true}})
      : await prisma.store.findUnique({where:{ownerId:session.userId},select:{id:true}});
    if (!store) return NextResponse.json({error:"STORE_NOT_FOUND"},{status:404});
    const product = await importSupplierProduct(prisma,new CjCatalogProvider(),defaultSupplierMediaProvider(),{storeId:store.id,supplierProductId:String(body.supplierProductId??""),sellingPrice:Number(body.sellingPrice),category:String(body.category??"Other")});
    return NextResponse.json({ok:true,productId:product.id,status:"DRAFT"},{status:201});
  } catch (error) {
    const code=error instanceof Error?error.message:"SUPPLIER_IMPORT_FAILED";
    const status=code==="SUPPLIER_NOT_CONFIGURED"||code==="CJ_NOT_CONFIGURED"?503:code==="SUPPLIER_PRODUCT_ALREADY_IMPORTED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
