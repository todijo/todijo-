import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { getLocale } from "next-intl/server";
import { confirmSellerClosure, SellerClosureError } from "@/lib/seller-closure";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  try {
    const result = await confirmSellerClosure(prisma, body?.token);
    const user=await prisma.user.findUniqueOrThrow({where:{id:result.userId},select:{role:true,authVersion:true}});
    await createSession({userId:result.userId,role:user.role,authVersion:user.authVersion});
    return NextResponse.json({ ok: true, changed: result.changed,locale:await getLocale() });
  } catch (error) {
    if (error instanceof SellerClosureError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller closure confirmation failed.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "CLOSURE_CONFIRMATION_FAILED" }, { status: 503 });
  }
}
