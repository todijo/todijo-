import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { customerStoreLoyaltyTrace, loyaltyEventPage, storeLoyaltyAccounting } from "@/lib/loyalty-analytics";
import { auditOrderLoyaltySnapshot, orderLoyaltyFundingTrace } from "@/lib/loyalty-order-reconciliation";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const search = new URL(request.url).searchParams;
    const storeId = search.get("storeId")?.trim() ?? "";
    const buyerId = search.get("buyerId")?.trim() ?? "";
    if (!storeId || storeId.length > 100 || buyerId.length > 100 ||
      (search.get("orderId")?.length ?? 0) > 100 || (search.get("cursor")?.length ?? 0) > 100) return NextResponse.json(
      { error: "INVALID_LOYALTY_LOOKUP" }, { status: 400, headers });
    const now = new Date();
    const from = search.get("from") ? new Date(search.get("from")!) : new Date(now.getTime() - 30 * 86_400_000);
    const to = search.get("to") ? new Date(search.get("to")!) : now;
    const report = await loyaltyEventPage(prisma, { storeId, from, to,
      buyerId: buyerId || undefined, orderId: search.get("orderId") || undefined,
      cursor: search.get("cursor") || undefined });
    const accounting = await storeLoyaltyAccounting(prisma, storeId);
    const customer = buyerId ? await customerStoreLoyaltyTrace(prisma, buyerId, storeId) : null;
    const order = search.get("orderId")
      ? await orderLoyaltyFundingTrace(prisma, search.get("orderId")!, storeId) : null;
    const orderSnapshot = order?.length
      ? await auditOrderLoyaltySnapshot(prisma, search.get("orderId")!) : null;
    return NextResponse.json({ accounting, customer, report, order, orderSnapshot }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json(
      { error: "INVALID_LOYALTY_REPORT_RANGE" }, { status: 400, headers });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status, headers });
  }
}
