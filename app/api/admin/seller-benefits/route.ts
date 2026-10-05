import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { SellerBenefitError, saveSellerBenefitItem, setSellerBenefitAccess } from "@/lib/seller-benefits";
import { sellerBusinessCommercialPlan } from "@/lib/seller-business";
import { hasProSellerCapabilities } from "@/lib/seller-commercial-access";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof AdminAccessError || error instanceof SellerBenefitError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "STATE_CHANGED" }, { status: 409 });
  console.error("Admin seller benefits action failed", error);
  return NextResponse.json({ error: "BENEFITS_ADMIN_FAILED" }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin(prisma, await readSession());
    const [businesses, items, requests] = await Promise.all([
      prisma.sellerBusiness.findMany({ where: { owner: { role: "SELLER" } }, orderBy: [{ owner: { firstName: "asc" } }, { id: "asc" }], include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } }, stores: { select: { id: true, name: true, slug: true }, orderBy: { createdAt: "asc" } }, benefitAccess: true } }),
      prisma.sellerBenefitCatalogItem.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
      prisma.sellerBenefitRequest.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { business: { include: { owner: { select: { firstName: true, lastName: true, email: true } } } }, store: { select: { name: true } }, item: { select: { name: true } } } }),
    ]);
    const enriched = await Promise.all(businesses.map(async business => ({ ...business, isPro: hasProSellerCapabilities(await sellerBusinessCommercialPlan(prisma, business.id)) })));
    return NextResponse.json({ businesses: enriched.filter(business => business.isPro), items, requests }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertAdminMutationRequest(request);
    const admin = await requireAdmin(prisma, await readSession());
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") throw new SellerBenefitError("INVALID_REQUEST", 400);
    if (body.action === "access" && typeof body.businessId === "string" && typeof body.enabled === "boolean") {
      const access = await setSellerBenefitAccess(prisma, { businessId: body.businessId, adminId: admin.id, enabled: body.enabled });
      return NextResponse.json({ access });
    }
    if (body.action === "item") {
      const date = (value: unknown) => value === null || value === "" ? null : typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
      const availableFrom = date(body.availableFrom), availableUntil = date(body.availableUntil);
      if (availableFrom === undefined || availableUntil === undefined || typeof body.name !== "string" || typeof body.description !== "string" || (body.priceType !== "FREE" && body.priceType !== "SPECIAL") || typeof body.priceMinor !== "number" || typeof body.quantityLimitPerStore !== "number" || typeof body.active !== "boolean" || (body.id !== undefined && typeof body.id !== "string")) throw new SellerBenefitError("INVALID_ITEM", 400);
      const item = await saveSellerBenefitItem(prisma, { adminId: admin.id, id: body.id as string | undefined, name: body.name, description: body.description, priceType: body.priceType, priceMinor: body.priceMinor, quantityLimitPerStore: body.quantityLimitPerStore, active: body.active, availableFrom, availableUntil });
      return NextResponse.json({ item }, { status: body.id ? 200 : 201 });
    }
    throw new SellerBenefitError("INVALID_REQUEST", 400);
  } catch (error) { return failure(error); }
}
