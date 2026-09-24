import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { LoyaltySettingsError, loyaltyActivationReady, readLoyaltySettings, updateLoyaltySettings } from "@/lib/loyalty-settings";
import { storeLoyaltyAccounting } from "@/lib/loyalty-analytics";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const [settings, history, globalAccounting] = await Promise.all([
      readLoyaltySettings(prisma),
      prisma.loyaltySettingsChange.findMany({ orderBy: { createdAt: "desc" }, take: 50,
        select: { id: true, adminId: true, oldEnabled: true, newEnabled: true,
          oldRateBps: true, newRateBps: true, oldMinRateBps: true, newMinRateBps: true,
          oldMaxRateBps: true, newMaxRateBps: true, oldExpiryDays: true,
          newExpiryDays: true, reason: true, createdAt: true,
          admin: { select: { firstName: true, lastName: true, email: true } } } }),
      storeLoyaltyAccounting(prisma, null),
    ]);
    return NextResponse.json({ settings, history, globalAccounting,
      activationReady: loyaltyActivationReady() }, { headers });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireMobileAdmin(request);
    const settings = await updateLoyaltySettings(prisma, admin.id, await request.json().catch(() => null));
    return NextResponse.json({ settings }, { headers });
  } catch (error) {
    if (error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers });
  }
}
