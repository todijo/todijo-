import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { LoyaltySettingsError, readLoyaltySettings, setStoreLoyaltyParticipation } from "@/lib/loyalty-settings";
import { sellerLoyaltyAccounting } from "@/lib/loyalty-analytics";
import { orderLoyaltyFundingTrace } from "@/lib/loyalty-order-reconciliation";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const [settings, participation, accounting] = await Promise.all([
      readLoyaltySettings(prisma),
      prisma.store.findUniqueOrThrow({ where: { id: store.id },
        select: { loyaltyEnabled: true, loyaltyBlockedAt: true,
          _count: { select: { products: { where: { loyaltyEligible: true, supplierLink: null } } } } } }),
      sellerLoyaltyAccounting(prisma, store.id),
    ]);
    const orderId = new URL(request.url).searchParams.get("orderId")?.trim() ?? "";
    if (orderId.length > 100) throw new LoyaltySettingsError("INVALID_LOYALTY_LOOKUP", 400);
    const order = orderId ? await orderLoyaltyFundingTrace(prisma, orderId, store.id) : null;
    return NextResponse.json({ settings: { enabled: settings.enabled, rateBps: settings.rateBps },
      participation: { enabled: participation.loyaltyEnabled, blocked: Boolean(participation.loyaltyBlockedAt),
        eligibleProductCount: participation._count.products }, accounting, order }, { headers });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status, headers });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, store } = await requireMobileSeller(request);
    const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
    if (typeof body?.enabled !== "boolean") throw new LoyaltySettingsError("INVALID_PARTICIPATION");
    const participation = await setStoreLoyaltyParticipation(prisma, userId, store.id, body.enabled);
    return NextResponse.json({ participation }, { headers });
  } catch (error) {
    if (error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status, headers });
  }
}
