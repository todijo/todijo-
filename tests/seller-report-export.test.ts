import test from "node:test";
import assert from "node:assert/strict";
import { csvDocument, exactMinorDecimal, loadSellerFinanceExportRows, loadSellerStockExportRows, parseSellerReportMonth, sellerFinanceCsv, sellerReportMonthBounds, sellerStockCsv } from "../lib/seller-report-export";
import { sellerReportCopy } from "../i18n/seller-reports";
import { locales } from "../i18n/config";

test("seller report month is strict and produces UTC half-open month bounds", () => {
  assert.deepEqual(parseSellerReportMonth("2024-02"), { year: 2024, month: 2 });
  assert.equal(parseSellerReportMonth("2024-2"), null);
  assert.equal(parseSellerReportMonth("2024-13"), null);
  assert.equal(parseSellerReportMonth("1999-12"), null);
  assert.deepEqual(sellerReportMonthBounds(2024, 2), { start: new Date("2024-02-01T00:00:00.000Z"), end: new Date("2024-03-01T00:00:00.000Z") });
  assert.deepEqual(parseSellerReportMonth(null, new Date("2026-10-09T10:00:00Z")), { year: 2026, month: 10 });
});

test("seller CSV escaping handles commas, quotes, line breaks and spreadsheet formulas", () => {
  assert.equal(csvDocument(["Name"], [["=HYPERLINK(\"x\")"]]), 'Name\r\n"\'=HYPERLINK(""x"")"\r\n');
  assert.equal(csvDocument(["Name"], [['Seller, "A"\r\nshop']]), 'Name\r\n"Seller, ""A""\r\nshop"\r\n');
  assert.equal(exactMinorDecimal(12345, "EUR"), "123.45");
  assert.equal(exactMinorDecimal(12345, "JPY"), "12345");
  assert.equal(exactMinorDecimal(Number.MAX_SAFE_INTEGER + 1, "EUR"), "");
});

test("seller finance report exports store-level paid order group accounting, refunds and transfer state", () => {
  const row = { paymentDate: new Date("2026-10-05T12:00:00Z"), orderId: "order-1", currency: "EUR", itemSubtotalMinor: 1599, shippingMinor: 450, commissionMinor: 120, commissionReversedMinor: 20, refundedCashMerchandiseMinor: 333, refundedShippingMinor: 100, sellerNetMinor: 1929, sellerRecoveredMinor: 300, transferStatus: "TRANSFERRED", transferredAt: new Date("2026-10-07T12:00:00Z") };
  const labels = sellerReportCopy("fr");
  const csv = sellerFinanceCsv([row], labels);
  assert.match(csv, /^Date de paiement,Commande,Devise,/);
  assert.match(csv, /2026-10-05T12:00:00\.000Z,order-1,EUR,15\.99,4\.50,1\.00,4\.33,16\.29,TRANSFERRED,2026-10-07T12:00:00\.000Z/);
  assert.doesNotMatch(csv, /buyer|email|address|stripe/i);
});

test("finance export query is store-scoped, marketplace-only and bounded by payment date", async () => {
  let query: any;
  const db = { orderGroup: { findMany: async (input: any) => { query = input; return []; } } } as any;
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await loadSellerFinanceExportRows(db, "store-2", start, end);
  assert.equal(query.where.storeId, "store-2");
  assert.equal(query.where.kind, "MARKETPLACE");
  assert.deepEqual(query.where.order.paidAt, { gte: start, lt: end });
  assert.match(query.orderBy[0].order.paidAt, /asc/);
  assert.equal(query.take, 250);
});

test("finance export advances with a stable cursor instead of loading an unbounded page", async () => {
  const queries: any[] = [];
  let pages = 0;
  const db = { orderGroup: { findMany: async (input: any) => { queries.push(input); pages++; return pages === 1 ? Array.from({ length: 250 }, (_, index) => ({ id: `g${index}`, itemSubtotalMinor: 1, shippingAmountMinor: 0, platformFeeAmountMinor: 0, commissionReversedMinor: 0, refundedCashMerchandiseMinor: 0, refundedShippingMinor: 0, sellerNetAmountMinor: 1, sellerRecoveredMinor: 0, transferStatus: "NONE", transferredAt: null, order: { id: `o${index}`, currency: "EUR", paidAt: new Date("2026-01-01Z") } })) : []; } } } as any;
  const rows = await loadSellerFinanceExportRows(db, "store", new Date("2026-01-01Z"), new Date("2026-02-01Z"));
  assert.equal(rows.length, 250);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[1].cursor, { id: "g249" });
  assert.equal(queries[1].skip, 1);
});

test("stock export includes simple products and actual variant keys without removed products", async () => {
  const calls: any[] = [];
  const db = {
    product: { findMany: async (input: any) => { calls.push(input); return [{ name: "Simple", stock: 3, price: { toString: () => "9.50" }, status: "PUBLISHED" }]; } },
    productVariant: { findMany: async (input: any) => { calls.push(input); return [{ combinationKey: "color:blue:size:m", sku: "SKU-1", stock: 0, priceOverride: null, active: true, product: { name: "Variant item", price: { toString: () => "12.00" } } }]; } },
  } as any;
  const rows = await loadSellerStockExportRows(db, "store-1");
  assert.equal(calls[0].where.storeId, "store-1");
  assert.equal(calls[0].where.removedAt, null);
  assert.deepEqual(calls[0].where.variants, { none: {} });
  assert.equal(calls[1].where.product.storeId, "store-1");
  assert.equal(calls[1].where.product.removedAt, null);
  assert.deepEqual(rows, [
    { product: "Simple", variant: "", sku: "", stock: 3, price: "9.50", status: "PUBLISHED" },
    { product: "Variant item", variant: "color:blue:size:m", sku: "SKU-1", stock: 0, price: "12.00", status: "ACTIVE" },
  ]);
  assert.match(sellerStockCsv(rows, sellerReportCopy("en")), /^Product,Variant,SKU,Stock,Price,Status\r\n/);
});

test("seller report labels have exact 14-locale parity and approved French and English wording", () => {
  const keys = Object.keys(sellerReportCopy("en")).sort();
  for (const locale of locales) {
    const copy = sellerReportCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const key of keys) assert.ok(copy[key as keyof typeof copy], `${locale}.${key}`);
  }
  assert.equal(sellerReportCopy("fr").downloadReport, "Télécharger le rapport");
  assert.equal(sellerReportCopy("en").downloadReport, "Download report");
  assert.equal(sellerReportCopy("fr").downloadStock, "Télécharger le stock");
  assert.equal(sellerReportCopy("en").downloadStock, "Download stock");
  assert.equal(sellerReportCopy("fr").commission, "Commission Todijo");
  assert.equal(sellerReportCopy("en").commission, "Todijo commission");
});
