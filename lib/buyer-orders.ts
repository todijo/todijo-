import { Prisma, type PrismaClient } from "@prisma/client";

const buyerOrderInclude = Prisma.validator<Prisma.OrderInclude>()({
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          store: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
});

export type BuyerOrder = Prisma.OrderGetPayload<{ include: typeof buyerOrderInclude }>;
type BuyerOrderDb = Pick<PrismaClient, "order">;

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
