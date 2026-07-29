import { Prisma, type PrismaClient } from "@prisma/client";

export const ORDER_HISTORY_PAGE_SIZE = 20;
export const ORDER_REFERENCE_MAX_LENGTH = 100;

const orderHistoryInclude = Prisma.validator<Prisma.OrderInclude>()({
  buyer: { select: { firstName: true, lastName: true } },
  items: {
    select: {
      id: true, quantity: true, productNameSnapshot: true,
      product: { select: { name: true, store: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  },
});

const sellerOrderHistoryInclude = Prisma.validator<Prisma.OrderInclude>()({
  ...orderHistoryInclude,
  refundRequest: {
    select: {
      id: true,
      reason: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      reviewedAt: true,
    },
  },
});

const adminOrderHistoryInclude = Prisma.validator<Prisma.OrderInclude>()({
  ...orderHistoryInclude,
  refundRequest: {
    select: {
      id: true,
      reason: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      reviewedAt: true,
    },
  },
});

export type OrderHistoryRow = Prisma.OrderGetPayload<{ include: typeof orderHistoryInclude }>;
export type SellerOrderHistoryRow = Prisma.OrderGetPayload<{ include: typeof sellerOrderHistoryInclude }>;
export type AdminOrderHistoryRow = Prisma.OrderGetPayload<{ include: typeof adminOrderHistoryInclude }>;
type OrderHistoryDb = Pick<PrismaClient, "order">;

export function normalizeOrderReferenceSearch(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^#/, "").slice(0, ORDER_REFERENCE_MAX_LENGTH) : "";
}

export function normalizeOrderHistoryPage(value: unknown) {
  const page = typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

function pageInput(page: number) {
  return { skip: (page - 1) * ORDER_HISTORY_PAGE_SIZE, take: ORDER_HISTORY_PAGE_SIZE };
}

function referenceFilter(query: string): Prisma.OrderWhereInput {
  return query ? { id: { contains: query, mode: "insensitive" } } : {};
}

export function sellerOrderHistoryWhere(sellerId: string, storeId: string, query: string): Prisma.OrderWhereInput {
  return {
    AND: [
      { OR: [
        { storeIdSnapshot: storeId },
        {
          storeIdSnapshot: null,
          items: {
            some: { product: { store: { ownerId: sellerId } } },
            every: { product: { store: { ownerId: sellerId } } },
          },
        },
      ] },
      referenceFilter(query),
    ],
  };
}

export async function listSellerOrderHistory(db: OrderHistoryDb, sellerId: string, storeId: string, query: unknown, pageInputValue: unknown) {
  const search = normalizeOrderReferenceSearch(query);
  const requestedPage = normalizeOrderHistoryPage(pageInputValue);
  const where = sellerOrderHistoryWhere(sellerId, storeId, search);
  const total = await db.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ORDER_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const orders = await db.order.findMany({ where, include: sellerOrderHistoryInclude, orderBy: { createdAt: "desc" }, ...pageInput(page) });
  return { orders, total, page, search, pageSize: ORDER_HISTORY_PAGE_SIZE };
}

export async function listAdminOrderHistory(db: OrderHistoryDb, query: unknown, pageInputValue: unknown) {
  const search = normalizeOrderReferenceSearch(query);
  const requestedPage = normalizeOrderHistoryPage(pageInputValue);
  const where = referenceFilter(search);
  const total = await db.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ORDER_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const orders = await db.order.findMany({ where, include: adminOrderHistoryInclude, orderBy: { createdAt: "desc" }, ...pageInput(page) });
  return { orders, total, page, search, pageSize: ORDER_HISTORY_PAGE_SIZE };
}
