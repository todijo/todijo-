import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { syncSupplierProduct } from "@/lib/suppliers/supplier-products";

export async function POST(_request:Request,context:{params:Promise<{id:string}>}) {
  const session=await readSession(); if(!session||!["SELLER","ADMIN"].includes(session.role)) return NextResponse.json({error:"SUPPLIER_ACCESS_DENIED"},{status:403});
  const {id}=await context.params;
  const product=await prisma.product.findFirst({where:{id,...(session.role==="ADMIN"?{}:{store:{ownerId:session.userId}})},select:{id:true}});
  if(!product)return NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404});
  try{return NextResponse.json({ok:true,...await syncSupplierProduct(prisma,new CjCatalogProvider(),id)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"SUPPLIER_SYNC_FAILED"},{status:502});}
}
