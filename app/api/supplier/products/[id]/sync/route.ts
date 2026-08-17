import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { syncSupplierProduct } from "@/lib/suppliers/supplier-products";
import { requirePlatformSupplierAdmin, requirePlatformSupplierProduct } from "@/lib/suppliers/supplier-access";
import { MutationOriginError, assertAdminMutationRequest } from "@/lib/request-security";

export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try{assertAdminMutationRequest(request);}catch(error){if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});throw error;}
  const session=await readSession(); try { await requirePlatformSupplierAdmin(prisma,session); } catch { return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:403}); }
  const {id}=await context.params;
  try { await requirePlatformSupplierProduct(prisma,id); } catch { return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404}); }
  try{return NextResponse.json({ok:true,...await syncSupplierProduct(prisma,new CjCatalogProvider(),id)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"SUPPLIER_SYNC_FAILED"},{status:502});}
}
