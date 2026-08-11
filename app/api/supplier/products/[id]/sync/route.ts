import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { syncSupplierProduct } from "@/lib/suppliers/supplier-products";
import { requirePlatformSupplierAdmin, requirePlatformSupplierProduct } from "@/lib/suppliers/supplier-access";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const session=await readSession(); try { await requirePlatformSupplierAdmin(prisma,session); } catch { return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:403}); }
  const {id}=await context.params;
  try { await requirePlatformSupplierProduct(prisma,id); } catch { return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404}); }
  try{return NextResponse.json({ok:true,...await syncSupplierProduct(prisma,new CjCatalogProvider(),id)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"SUPPLIER_SYNC_FAILED"},{status:502});}
}
