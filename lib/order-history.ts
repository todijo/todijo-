import { Prisma, type PrismaClient } from "@prisma/client";

export const ORDER_HISTORY_PAGE_SIZE = 20;
export const ORDER_REFERENCE_MAX_LENGTH = 100;

const orderHistoryInclude = Prisma.validator<Prisma.OrderInclude>()({
  buyer: { select: { firstName: true, lastName: true } },
  items: {
    select: {
      id: true, quantity: true, productNameSnapshot: true, variantTitleSnapshot: true, selectedColor: true, selectedSize: true, lineTotal: true, unitPrice: true,
      product: { select: { name: true, store: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  },
});

const sellerOrderHistoryInclude = Prisma.validator<Prisma.OrderInclude>()({
  ...orderHistoryInclude,
  items: {
    select: {
      id: true, quantity: true, productNameSnapshot: true, variantTitleSnapshot: true, selectedColor: true, selectedSize: true, lineTotal: true, unitPrice: true,
      product: { select: { id: true, name: true, storeId: true, store: { select: { name: true } } } },
      orderGroup: { select: { id: true, storeId: true, itemSubtotalMinor: true, shippingAmountMinor: true, shipments: { where: { status: { not: "CANCELLED" } }, select: { items: { select: { orderItemId: true, quantity: true } } } } } },
      refundAllocations: { select: { quantity: true, refundOperation: { select: { status: true } } } },
    },
    orderBy: { createdAt: "asc" },
  },
  refundRequest: {
    select: {
      id: true,
      orderId: true,
      reason: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      reviewedAt: true,
      evidence: {
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
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
  void sellerId;
  return {
    AND: [
      { OR: [
        { groups: { some: { storeId } } },
        { AND: [
          { groups: { none: {} } },
          { items: { some: { product: { storeId } } } },
          { items: { every: { product: { storeId } } } },
        ] },
      ] },
      referenceFilter(query),
    ],
  };
}

export function sellerOrderItemBelongsToStore(item: { orderGroup?: { storeId: string | null } | null; product: { storeId?: string } }, storeId: string) {
  return item.orderGroup ? item.orderGroup.storeId === storeId : item.product.storeId === storeId;
}

export async function listSellerOrderHistory(db: OrderHistoryDb, sellerId: string, storeId: string, query: unknown, pageInputValue: unknown) {
  const search = normalizeOrderReferenceSearch(query);
  const requestedPage = normalizeOrderHistoryPage(pageInputValue);
  const where = sellerOrderHistoryWhere(sellerId, storeId, search);
  const total = await db.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ORDER_HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const orders = (await db.order.findMany({ where, include: sellerOrderHistoryInclude, orderBy: { createdAt: "desc" }, ...pageInput(page) })).map((order) => ({
    ...order,
    items: order.items.filter((item) => sellerOrderItemBelongsToStore(item, storeId)),
  }));
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
