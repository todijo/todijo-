import { Prisma, type OrderStatus } from "@prisma/client";
import { buyerPaymentState } from "./buyer-orders";

export const ADMIN_MARKETPLACE_PAGE_SIZE = 20;
export const ADMIN_MARKETPLACE_SEARCH_MAX_LENGTH = 100;

export function normalizeAdminSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, ADMIN_MARKETPLACE_SEARCH_MAX_LENGTH) : "";
}

export function normalizeAdminPage(value: unknown) {
  const page = typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export function adminPage(total: number, requested: unknown) {
  const pages = Math.max(1, Math.ceil(total / ADMIN_MARKETPLACE_PAGE_SIZE));
  const page = Math.min(normalizeAdminPage(requested), pages);
  return { page, pages, skip: (page - 1) * ADMIN_MARKETPLACE_PAGE_SIZE, take: ADMIN_MARKETPLACE_PAGE_SIZE };
}

export const paidOrderWhere: Prisma.OrderWhereInput = {
  status: { not: "REFUNDED" },
  OR: [{ paidAt: { not: null } }, { stripePaymentIntentId: { not: null } }],
};

export function isPaidOrder(order: { status: OrderStatus; paidAt: Date | null; stripePaymentIntentId: string | null }) {
  return buyerPaymentState(order as Parameters<typeof buyerPaymentState>[0]) === "paid";
}

export function adminBuyerWhere(search: string): Prisma.UserWhereInput {
  return {
    AND: [
      { OR: [{ role: "CUSTOMER" }, { orders: { some: {} } }] },
      ...(search ? [{ OR: [
        { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ] }] : []),
    ],
  };
}

export function adminSellerWhere(search: string): Prisma.StoreWhereInput {
  return {
    AND: [
      {},
      ...(search ? [{ OR: [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { owner: { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { owner: { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { owner: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      ] }] : []),
    ],
  };
}

export function adminOrderWhere(search: string): Prisma.OrderWhereInput {
  return search ? { id: { contains: search, mode: "insensitive" } } : {};
}

export function moneyGroups(rows: Array<{ currency: string | null; amount: Prisma.Decimal | null }>, fallbackCurrency?: string) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    const currency = row.currency ?? fallbackCurrency;
    if (!currency || !row.amount) continue;
    totals.set(currency, (totals.get(currency) ?? new Prisma.Decimal(0)).add(row.amount));
  }
  return [...totals.entries()].map(([currency, total]) => ({ currency, total }));
}

export function orderStoreNames(order: { storeNameSnapshot: string | null; storeIdSnapshot: string | null; items: Array<{ product: { store: { id: string; name: string } } }> }) {
  if (order.storeIdSnapshot && order.storeNameSnapshot) return [order.storeNameSnapshot];
  return [...new Map(order.items.map((item) => [item.product.store.id, item.product.store.name])).values()];
}

export function sellerItemAmount(item: { lineTotal: Prisma.Decimal | null; unitPrice: Prisma.Decimal; quantity: number }) {
  return item.lineTotal ?? item.unitPrice.mul(item.quantity);
}

export function sellerOrderMetrics(items: Array<{ orderId: string; storeId: string; status: OrderStatus; paidAt: Date | null; stripePaymentIntentId: string | null; currency: string | null; amount: Prisma.Decimal }>) {
  const attributedOrders = new Set<string>(); const paidOrders = new Set<string>(); const totals: Array<{ currency: string | null; amount: Prisma.Decimal }> = [];
  for (const item of items) { attributedOrders.add(`${item.storeId}:${item.orderId}`); if (isPaidOrder(item)) { paidOrders.add(`${item.storeId}:${item.orderId}`); totals.push({ currency: item.currency, amount: item.amount }); } }
  return { attributedOrders, paidOrders, totals };
}
