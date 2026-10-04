import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { assertSellerActivity } from "@/lib/account-status";
import { ensureSellerBusiness } from "@/lib/seller-business";
import { verifySellerBusinessIdentifiers } from "@/lib/seller-business-verification";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const business = await prisma.sellerBusiness.findUnique({ where: { ownerId: session.userId }, select: { siren: true, inseeVerificationState: true, inseeVerifiedAt: true, inseeVerificationSource: true, inseeVerificationReason: true, establishments: { orderBy: { createdAt: "asc" }, select: { siret: true, verificationState: true, verifiedAt: true, verificationSource: true, verificationReason: true } } } });
    return NextResponse.json({ verification: business ? { siren: business.siren, state: business.inseeVerificationState, verifiedAt: business.inseeVerifiedAt?.toISOString() ?? null, source: business.inseeVerificationSource, reason: business.inseeVerificationReason, establishments: business.establishments.map((item) => ({ siret: item.siret, state: item.verificationState, verifiedAt: item.verifiedAt?.toISOString() ?? null, source: item.verificationSource, reason: item.verificationReason })) } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "BUSINESS_VERIFICATION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role === "ADMIN") return NextResponse.json({ error: "ADMIN_ROLE_PROTECTED" }, { status: 403 });
  try {
    await assertSellerActivity(prisma, session.userId);
    const body = await request.json();
    if (body.sellerType !== "PROFESSIONAL" || !["FR", "FRANCE"].includes(String(body.country ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())) return NextResponse.json({ error: "FRENCH_PROFESSIONAL_REQUIRED" }, { status: 400 });
    const business = await prisma.$transaction(async (tx) => ensureSellerBusiness(tx, session.userId));
    const result = await verifySellerBusinessIdentifiers(prisma, { businessId: business.id, actorId: session.userId, siren: body.businessSiren, siret: body.businessRegistrationNumber });
    return NextResponse.json({ state: result.state, code: result.code, retryAfter: result.retryAfter?.toISOString() ?? null }, { status: result.state === "REJECTED" ? 422 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "BUSINESS_VERIFICATION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
