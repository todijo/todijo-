import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { listSellerProducts, parseSellerProductsQuery } from "@/lib/seller-products-pagination";
import { resolveSellerStoreContext, SellerCapabilityError } from "@/lib/seller-business-access";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const params=new URL(request.url).searchParams;
  let context;try{context=await resolveSellerStoreContext(prisma,session.userId,params.get("store"),"PRODUCT_VIEW")}catch(error){if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});throw error}
  const query = parseSellerProductsQuery(params);
  const result = await listSellerProducts(prisma, context.selected.id, query);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
