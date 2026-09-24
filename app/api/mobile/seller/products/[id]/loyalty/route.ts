import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { productLoyaltyEligibility } from "@/lib/loyalty-eligibility";
import { LoyaltySettingsError } from "@/lib/loyalty-settings";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { store } = await requireMobileSeller(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => null) as { eligible?: unknown } | null;
    if (!body || !Object.hasOwn(body, "eligible")) throw new LoyaltySettingsError("INVALID_PRODUCT_LOYALTY");
    const product = await prisma.product.findFirst({
      where: { id, storeId: store.id, removedAt: null, dataClass: "PRODUCTION" },
      select: { id: true, supplierLink: { select: { id: true } } },
    });
    if (!product) throw new LoyaltySettingsError("PRODUCT_NOT_FOUND", 404);
    const loyaltyEligible = productLoyaltyEligibility(body.eligible, Boolean(product.supplierLink));
    const changed = await prisma.product.updateMany({
      where: { id, storeId: store.id, removedAt: null,
        ...(loyaltyEligible ? { supplierLink: null } : {}) },
      data: { loyaltyEligible },
    });
    if (changed.count !== 1) throw new LoyaltySettingsError("PRODUCT_CHANGED_RETRY", 409);
    return NextResponse.json({ loyaltyEligible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
