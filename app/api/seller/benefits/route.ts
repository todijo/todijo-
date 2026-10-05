import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { SellerCapabilityError } from "@/lib/seller-business-access";
import { AdminAccessError } from "@/lib/admin-access";
import { SellerBenefitError, listSellerBenefits, requestSellerBenefit } from "@/lib/seller-benefits";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof SellerBenefitError || error instanceof SellerCapabilityError || error instanceof AdminAccessError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "STATE_CHANGED" }, { status: 409 });
  console.error("Seller benefits request failed", error);
  return NextResponse.json({ error: "BENEFITS_UNAVAILABLE" }, { status: 503 });
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const storeId = new URL(request.url).searchParams.get("store") ?? "";
  if (!storeId || storeId.length > 100) return NextResponse.json({ error: "STORE_REQUIRED" }, { status: 400 });
  try {
    return NextResponse.json(await listSellerBenefits(prisma, session.userId, storeId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  if (!await allowAuthRequest(authRequestKey("seller-benefit-request", session.userId, request))) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.storeId !== "string" || typeof body.itemId !== "string" || typeof body.idempotencyKey !== "string" || typeof body.quantity !== "number") return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const created = await requestSellerBenefit(prisma, { userId: session.userId, storeId: body.storeId, itemId: body.itemId, quantity: body.quantity, idempotencyKey: body.idempotencyKey });
    return NextResponse.json({ request: { id: created.id, status: created.status } }, { status: 201 });
  } catch (error) { return failure(error); }
}
