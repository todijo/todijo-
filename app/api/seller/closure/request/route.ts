import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { AdminAccessError } from "@/lib/admin-access";
import { assertSellerActivity } from "@/lib/account-status";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { SellerClosureError, requestSellerClosure } from "@/lib/seller-closure";
import { getLocale } from "next-intl/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    await requireBusinessOwner(prisma, session.userId);
    await assertSellerActivity(prisma, session.userId);
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
    if (user?.role !== "SELLER") return NextResponse.json({ error: "SELLER_ACCOUNT_REQUIRED" }, { status: 403 });
    const locale = await getLocale();
    const result = await requestSellerClosure(prisma, { userId: session.userId, locale });
    return NextResponse.json({ ok: result.sent, reused: result.reused }, { status: result.sent ? 200 : 503 });
  } catch (error) {
    if (error instanceof SellerClosureError || error instanceof SellerCapabilityError || error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller closure request failed.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "CLOSURE_REQUEST_FAILED" }, { status: 503 });
  }
}
