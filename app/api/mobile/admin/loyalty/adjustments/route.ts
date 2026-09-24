import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding,
  revokePlatformLoyaltyCredit, cancelPendingPlatformLoyaltyPledge,
  repairSellerLoyaltyEarning,
  LoyaltyAdjustmentError, assertLoyaltyAdjustmentConfirmation } from "@/lib/loyalty-admin-adjustments";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "INVALID_LOYALTY_ADJUSTMENT" }, { status: 400, headers });
    assertLoyaltyAdjustmentConfirmation(body);
    const result = body.direction === "CREDIT"
      ? await issuePlatformLoyaltyCredit(prisma, admin.id, body)
      : body.direction === "DEBIT"
        ? await revokePlatformLoyaltyCredit(prisma, admin.id, body)
        : body.direction === "ATTEST_PLATFORM"
          ? await attestPlatformLoyaltyFunding(prisma, admin.id, body)
        : body.direction === "CANCEL_PLATFORM_PLEDGE"
          ? await cancelPendingPlatformLoyaltyPledge(prisma, admin.id, body)
        : body.direction === "SELLER_REPAIR"
          ? await repairSellerLoyaltyEarning(prisma, admin.id, body)
        : null;
    if (!result) return NextResponse.json({ error: "INVALID_LOYALTY_ADJUSTMENT" },
      { status: 400, headers });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof LoyaltyAdjustmentError)
      return NextResponse.json({ error: error.code }, { status: error.status, headers });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers });
  }
}
