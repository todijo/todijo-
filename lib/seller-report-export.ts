import "server-only";
import type { PrismaClient } from "@prisma/client";

export type SellerFinanceExportRow = {
  paymentDate: Date | null;
  orderId: string;
  currency: string;
  itemSubtotalMinor: number;
  shippingMinor: number;
  commissionMinor: number;
  commissionReversedMinor: number;
  refundedCashMerchandiseMinor: number;
  refundedShippingMinor: number;
  sellerNetMinor: number;
  sellerRecoveredMinor: number;
  transferStatus: string;
  transferredAt: Date | null;
};

export type SellerStockExportRow = {
  product: string;
  variant: string;
  sku: string;
  stock: number;
  price: string;
  status: string;
};

export async function loadSellerFinanceExportRows(db: Pick<PrismaClient, "orderGroup">, storeId: string, start: Date, end: Date): Promise<SellerFinanceExportRow[]> {
  const groups = await db.orderGroup.findMany({
    where: { storeId, kind: "MARKETPLACE", order: { paidAt: { gte: start, lt: end } } },
    orderBy: [{ order: { paidAt: "asc" } }, { id: "asc" }],
    select: { itemSubtotalMinor: true, shippingAmountMinor: true, platformFeeAmountMinor: true, commissionReversedMinor: true, refundedCashMerchandiseMinor: true, refundedShippingMinor: true, sellerNetAmountMinor: true, sellerRecoveredMinor: true, transferStatus: true, transferredAt: true, order: { select: { id: true, currency: true, paidAt: true } } },
  });
  return groups.map((group) => ({ paymentDate: group.order.paidAt, orderId: group.order.id, currency: group.order.currency, itemSubtotalMinor: group.itemSubtotalMinor, shippingMinor: group.shippingAmountMinor, commissionMinor: group.platformFeeAmountMinor, commissionReversedMinor: group.commissionReversedMinor, refundedCashMerchandiseMinor: group.refundedCashMerchandiseMinor, refundedShippingMinor: group.refundedShippingMinor, sellerNetMinor: group.sellerNetAmountMinor, sellerRecoveredMinor: group.sellerRecoveredMinor, transferStatus: group.transferStatus, transferredAt: group.transferredAt }));
}

export async function loadSellerStockExportRows(db: Pick<PrismaClient, "product" | "productVariant">, storeId: string): Promise<SellerStockExportRow[]> {
  const [products, variants] = await Promise.all([
    db.product.findMany({ where: { storeId, removedAt: null, variants: { none: {} } }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { name: true, stock: true, price: true, status: true } }),
    db.productVariant.findMany({ where: { product: { storeId, removedAt: null } }, orderBy: [{ product: { name: "asc" } }, { id: "asc" }], select: { combinationKey: true, sku: true, stock: true, priceOverride: true, active: true, product: { select: { name: true, price: true } } } }),
  ]);
  return [
    ...products.map((product) => ({ product: product.name, variant: "", sku: "", stock: product.stock, price: product.price.toString(), status: product.status })),
    ...variants.map((variant) => ({ product: variant.product.name, variant: variant.combinationKey, sku: variant.sku ?? "", stock: variant.stock, price: (variant.priceOverride ?? variant.product.price).toString(), status: variant.active ? "ACTIVE" : "INACTIVE" })),
  ];
}

export function parseSellerReportMonth(value: string | null, now = new Date()) {
  if (value == null || value === "") return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 9999) return null;
  return { year, month };
}

export function sellerReportMonthBounds(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

function safeCell(value: unknown) {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvDocument(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return [headers, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
}

function minorUnits(currency: string) {
  return new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF"]).has(currency.toUpperCase()) ? 0 : 2;
}

export function exactMinorDecimal(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount)) return "";
  const places = minorUnits(currency);
  const divisor = 10 ** places;
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute / divisor);
  if (places === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(absolute % divisor).padStart(places, "0")}`;
}

export function sellerFinanceCsv(rows: readonly SellerFinanceExportRow[], labels: {
  paymentDate: string; order: string; currency: string; merchandiseSales: string; shipping: string; commission: string; refunds: string; sellerAmount: string; transferStatus: string; transferDate: string;
}) {
  const headers = [labels.paymentDate, labels.order, labels.currency, labels.merchandiseSales, labels.shipping, labels.commission, labels.refunds, labels.sellerAmount, labels.transferStatus, labels.transferDate];
  const values = rows.map((row) => [row.paymentDate, row.orderId, row.currency,
    exactMinorDecimal(row.itemSubtotalMinor, row.currency), exactMinorDecimal(row.shippingMinor, row.currency),
    exactMinorDecimal(row.commissionMinor - row.commissionReversedMinor, row.currency),
    exactMinorDecimal(row.refundedCashMerchandiseMinor + row.refundedShippingMinor, row.currency),
    exactMinorDecimal(Math.max(0, row.sellerNetMinor - row.sellerRecoveredMinor), row.currency),
    row.transferStatus, row.transferredAt]);
  return csvDocument(headers, values);
}

export function sellerStockCsv(rows: readonly SellerStockExportRow[], labels: { product: string; variant: string; sku: string; stock: string; price: string; status: string }) {
  return csvDocument([labels.product, labels.variant, labels.sku, labels.stock, labels.price, labels.status], rows.map((row) => [row.product, row.variant, row.sku, row.stock, row.price, row.status]));
}
