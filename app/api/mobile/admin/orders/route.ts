import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { adminOrderWhere, adminPage, normalizeAdminOrderView, normalizeAdminSearch } from "@/lib/admin-marketplace";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const where = adminOrderWhere(normalizeAdminSearch(url.searchParams.get("q")), normalizeAdminOrderView(url.searchParams.get("view")));
    const total = await prisma.order.count({ where });
    const paging = adminPage(total, url.searchParams.get("page"));
    const orders = await prisma.order.findMany({ where, skip: paging.skip, take: paging.take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
        id: true, status: true, fulfillmentStatus: true, total: true, currency: true, createdAt: true, paidAt: true,
        shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true, storeNameSnapshot: true,
        buyer: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { id: true, quantity: true, productNameSnapshot: true } },
        refundRequest: { select: { id: true, status: true, reason: true, createdAt: true } },
        supplierFulfillments: { select: { id: true, status: true, supplierStatus: true, lastSyncedAt: true,
          tracking: { select: { carrier: true, trackingNumber: true, shippedAt: true } } } },
      } });
    return NextResponse.json({ ...paging, total, orders: orders.map(order => ({ ...order, total: order.total.toString() })) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
