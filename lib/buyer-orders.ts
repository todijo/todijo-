import { Prisma, type PrismaClient } from "@prisma/client";

const buyerOrderInclude = Prisma.validator<Prisma.OrderInclude>()({
  loyaltyFundingSnapshot: { select: { status: true, currency: true,
    grossMerchandiseMinor: true, eligibleMerchandiseMinor: true,
    excludedMerchandiseMinor: true, shippingMinor: true,
    newCashMinor: true, loyaltyRedeemedMinor: true } },
  refundOperations: { where: { status: "COMPLETED" },
    select: { id: true, totalAmountMinor: true,
      loyaltyRestoredMinor: true, createdAt: true } },
  lifecycleEvents: { select: { id: true, type: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  supplierFulfillments: {
    select: {
      status: true,
      supplierStatus: true,
      lastSyncedAt: true,
      tracking: { select: { carrier: true, trackingNumber: true, shippedAt: true, updatedAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  },
  items: {
    select: { id: true, quantity: true, unitPrice: true, lineTotal: true, selectedColor: true, selectedSize: true, selectedOptions: true, productNameSnapshot: true, productImageUrlSnapshot: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          store: { select: { name: true, slug: true } },
        },
      } },
    orderBy: { createdAt: "asc" },
  },
});

export type BuyerOrder = Prisma.OrderGetPayload<{ include: typeof buyerOrderInclude }>;
type BuyerOrderDb = Pick<PrismaClient, "order">;
export const BUYER_ORDER_PAGE_SIZE = 20;

export function buyerOrderPageNumber(value: unknown) {
  const page = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(page) && Number(page) > 0 ? Math.min(Number(page), 10_000) : 1;
}

export async function listBuyerOrdersPage(db: BuyerOrderDb, buyerId: string, requestedPage: unknown) {
  const page = buyerOrderPageNumber(requestedPage);
  const rows = await db.order.findMany({
    where: { buyerId },
    include: buyerOrderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * BUYER_ORDER_PAGE_SIZE,
    take: BUYER_ORDER_PAGE_SIZE + 1,
  });
  return { orders: rows.slice(0, BUYER_ORDER_PAGE_SIZE), page, pageSize: BUYER_ORDER_PAGE_SIZE, hasMore: rows.length > BUYER_ORDER_PAGE_SIZE };
}

export function listBuyerOrders(db: BuyerOrderDb, buyerId: string): Promise<BuyerOrder[]> {
  return db.order.findMany({
    where: { buyerId },
    include: buyerOrderInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function getBuyerOrder(db: BuyerOrderDb, buyerId: string, orderId: string): Promise<BuyerOrder | null> {
  return db.order.findFirst({
    where: { id: orderId, buyerId },
    include: buyerOrderInclude,
  });
}

export function buyerPaymentState(order: Pick<BuyerOrder, "status" | "paidAt" | "stripePaymentIntentId">) {
  if (order.status === "REFUNDED") return "refunded" as const;
  if (order.paidAt || order.stripePaymentIntentId) return "paid" as const;
  if (order.status === "CANCELLED") return "cancelled" as const;
  return "pending" as const;
}
