import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

export const SELLER_DISPATCH_DEADLINE_MS = 48 * 60 * 60 * 1000;
export const SELLER_HEALTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

export type SellerDispatchOutcome = "ON_TIME" | "LATE" | "UNKNOWN" | "EXCLUDED";

export type SellerDispatchRecord = {
  kind: string;
  orderStatus: string;
  paidAt: Date | null;
  shippedAt: Date | null;
  shipmentVerifiedAt: Date | null;
  supplierFulfilled: boolean;
};

export function sellerDispatchOutcome(record: SellerDispatchRecord, now = new Date()): SellerDispatchOutcome {
  if (record.kind !== "MARKETPLACE" || record.supplierFulfilled || record.orderStatus === "CANCELLED") return "EXCLUDED";
  if (record.orderStatus === "REFUNDED") return "UNKNOWN";
  if (!["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(record.orderStatus)) return "UNKNOWN";

  const paidAt = record.paidAt?.getTime();
  const nowMs = now.getTime();
  if (paidAt == null || !Number.isFinite(paidAt) || !Number.isFinite(nowMs) || paidAt > nowMs) return "UNKNOWN";

  const deadline = paidAt + SELLER_DISPATCH_DEADLINE_MS;
  const dispatchAt = record.shipmentVerifiedAt?.getTime();
  if (dispatchAt != null) {
    if (!Number.isFinite(dispatchAt) || dispatchAt < paidAt || dispatchAt > nowMs) return "UNKNOWN";
    return dispatchAt <= deadline ? "ON_TIME" : "LATE";
  }

  // A seller-entered tracking number or a shipping status without the established
  // shipment-verification timestamp is not sufficient dispatch evidence.
  if (record.shippedAt || ["SHIPPED", "DELIVERED"].includes(record.orderStatus)) return "UNKNOWN";
  return nowMs >= deadline ? "LATE" : "ON_TIME";
}

export function sellerHealthWindow(now = new Date()) {
  return { start: new Date(now.getTime() - SELLER_HEALTH_WINDOW_MS), end: new Date(now.getTime()) };
}

type SellerHealthDb = Pick<PrismaClient, "orderGroup">;

/**
 * Loads only the selected store's bounded 30-day order groups. Cursor pagination
 * keeps memory use bounded while the aggregation avoids exposing order details.
 */
export async function loadSellerDispatchHealth(db: SellerHealthDb, storeId: string, now = new Date()) {
  const { start, end } = sellerHealthWindow(now);
  const where: Prisma.OrderGroupWhereInput = {
    storeId,
    kind: "MARKETPLACE" as const,
    OR: [
      { order: { paidAt: { gte: start, lte: end } } },
      { order: { paidAt: null, status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"] }, createdAt: { gte: start, lte: end } } },
    ],
  };

  let cursor: string | undefined;
  let lateDispatches = 0;
  let unknownDispatches = 0;
  let observedOrderGroups = 0;
  for (;;) {
    const page = await db.orderGroup.findMany({
      where,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        kind: true,
        shipmentVerifiedAt: true,
        order: { select: { status: true, paidAt: true, shippedAt: true, createdAt: true } },
        items: { select: { supplierFulfillmentItem: { select: { id: true } } } },
      } as const,
    });
    for (const group of page) {
      const result = sellerDispatchOutcome({
        kind: group.kind,
        orderStatus: group.order.status,
        paidAt: group.order.paidAt,
        shippedAt: group.order.shippedAt,
        shipmentVerifiedAt: group.shipmentVerifiedAt,
        supplierFulfilled: group.items.some((item) => item.supplierFulfillmentItem != null),
      }, now);
      if (result === "EXCLUDED") continue;
      observedOrderGroups += 1;
      if (result === "LATE") lateDispatches += 1;
      if (result === "UNKNOWN") unknownDispatches += 1;
    }
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1]?.id;
    if (!cursor) break;
  }

  const ordersWithCashRefunds = await db.orderGroup.groupBy({
    by: ["orderId"],
    where: { storeId, kind: "MARKETPLACE", order: { paidAt: { gte: start, lte: end } }, OR: [{ refundedCashMerchandiseMinor: { gt: 0 } }, { refundedShippingMinor: { gt: 0 } }] },
  });

  return { lateDispatches, unknownDispatches, observedOrderGroups, ordersWithCashRefunds: ordersWithCashRefunds.length, windowStart: start, windowEnd: end };
}
