import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { activeAccessSource } from "@/lib/admin-access";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [users, stores, products, orders, pendingRefunds, pendingSellerReviews, openSupport, paidOrders30d] = await Promise.all([
      prisma.user.count(),
      prisma.store.findMany({ select: { subscription: { select: { status: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } }),
      prisma.product.count({ where: { removedAt: null } }),
      prisma.order.count(),
      prisma.refundRequest.count({ where: { status: { in: ["SELLER_APPROVED", "SELLER_REJECTED"] } } }),
      prisma.store.count({ where: { onboardingStatus: "PENDING_REVIEW" } }),
      prisma.supportRequest.count({ where: { status: "OPEN" } }),
      prisma.order.groupBy({ by: ["currency"], where: { paidAt: { gte: thirtyDaysAgo } }, _count: { id: true }, _sum: { total: true } }),
    ]);
    return NextResponse.json({
      users, stores: stores.length, activeStores: stores.filter(store => activeAccessSource(store, now).source !== "NONE").length,
      products, orders, pendingRefunds, pendingSellerReviews, openSupport,
      paidOrders30d: paidOrders30d.reduce((count, row) => count + row._count.id, 0),
      grossPaidOrderVolume30dByCurrency: paidOrders30d.map(row => ({
        currency: row.currency, orderCount: row._count.id, amount: row._sum.total?.toString() ?? "0",
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
