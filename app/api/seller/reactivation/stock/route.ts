import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { confirmSellerReactivationStock, SellerClosureError } from "@/lib/seller-closure";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { products?: unknown } | null;
  try {
    return NextResponse.json({ ok:true, ...(await confirmSellerReactivationStock(prisma,{userId:session.userId,products:body?.products})) });
  } catch (error) {
    if (error instanceof SellerClosureError) return NextResponse.json({ error:error.code },{status:error.status});
    console.error("Seller reactivation stock review failed.",error instanceof Error?error.name:"UnknownError");
    return NextResponse.json({error:"STOCK_REVIEW_FAILED"},{status:503});
  }
}
