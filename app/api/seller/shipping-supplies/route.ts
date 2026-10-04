import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requestProShippingSupplies, ShippingSuppliesError } from "@/lib/pro-shipping-supplies";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { SellerCapabilityError } from "@/lib/seller-business-access";
import { AdminAccessError } from "@/lib/admin-access";
import { defaultLocale, isLocale } from "@/i18n/config";
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  if (!await allowAuthRequest(authRequestKey("shipping-supplies", session.userId, request))) return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  try {
    const body = await request.json();
    const created = await requestProShippingSupplies(prisma, session.userId, body.message, isLocale(body.locale) ? body.locale : defaultLocale);
    return NextResponse.json({ reference: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ShippingSuppliesError || error instanceof SellerCapabilityError || error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "REQUEST_UNAVAILABLE" }, { status: 503 });
  }
}
