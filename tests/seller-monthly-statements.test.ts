import test from "node:test";
import assert from "node:assert/strict";
import { locales } from "../i18n/config";
import { sellerMonthlyStatementCopy } from "../i18n/seller-monthly-statements";
import { sellerMonthlyStatementCsv, createSellerMonthlyStatementRevisions } from "../lib/seller-monthly-statements";
import { sellerReportCopy } from "../i18n/seller-reports";

test("monthly statement copy has 14-locale parity and approved English/French wording", () => {
  const keys = Object.keys(sellerMonthlyStatementCopy("en")).sort();
  for (const locale of locales) {
    const copy = sellerMonthlyStatementCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const key of keys) assert.ok(copy[key as keyof typeof copy], `${locale}.${key}`);
  }
  assert.deepEqual(sellerMonthlyStatementCopy("fr"), { title: "Relevés mensuels", period: "Période", download: "Télécharger le relevé", revision: "Version {revision}", empty: "Aucun relevé mensuel disponible." });
  assert.deepEqual(sellerMonthlyStatementCopy("en"), { title: "Monthly statements", period: "Period", download: "Download statement", revision: "Revision {revision}", empty: "No monthly statements are available." });
});

test("monthly statement CSV is a stable snapshot and labels refunds/commission without inventing tax data", () => {
  const csv = sellerMonthlyStatementCsv({ year: 2026, month: 8, currency: "EUR", revision: 1, snapshot: { rows: [{ paymentDate: "2026-08-05T12:00:00.000Z", orderId: "ord_1", currency: "EUR", itemSubtotalMinor: 1599, shippingMinor: 450, commissionMinor: 120, commissionReversedMinor: 20, refundedCashMerchandiseMinor: 333, refundedShippingMinor: 100, sellerNetMinor: 1929, sellerRecoveredMinor: 300, transferStatus: "TRANSFERRED", transferredAt: "2026-08-07T12:00:00.000Z" }] } }, sellerReportCopy("en"));
  assert.match(csv, /Payment date,Order,Currency/);
  assert.match(csv, /ord_1,EUR,15\.99,4\.50,1\.00,4\.33,16\.29/);
  assert.doesNotMatch(csv, /VAT|tax invoice|credit note/i);
});

test("monthly statement generation snapshots empty completed months and is idempotent", async () => {
  const saved = new Map<string, any>();
  let creates = 0;
  const db = {
    store: { findUnique: async () => ({ id: "store_1", businessId: "biz_1", currency: "EUR", createdAt: new Date("2025-10-01T00:00:00Z") }) },
    orderGroup: { findMany: async () => [] },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [],
      orderGroup: { findMany: async () => [] },
      sellerMonthlyStatement: {
        findUnique: async ({ where }: any) => saved.get(`${where.storeId_year_month_currency_contentHash.storeId}:${where.storeId_year_month_currency_contentHash.year}:${where.storeId_year_month_currency_contentHash.month}:${where.storeId_year_month_currency_contentHash.currency}:${where.storeId_year_month_currency_contentHash.contentHash}`) ?? null,
        findFirst: async ({ where }: any) => { const revisions = [...saved.values()].filter((item) => item.storeId === where.storeId && item.year === where.year && item.month === where.month && item.currency === where.currency); return revisions.length ? { revision: Math.max(...revisions.map((item) => item.revision)) } : null; },
        create: async ({ data }: any) => { creates++; const result = { id: `st_${creates}`, ...data, createdAt: new Date("2026-10-01T00:00:00Z") }; saved.set(`${data.storeId}:${data.year}:${data.month}:${data.currency}:${data.contentHash}`, result); return result; },
      },
    }),
  } as any;
  const first = await createSellerMonthlyStatementRevisions(db, { businessId: "biz_1", storeId: "store_1", now: new Date("2026-10-10T00:00:00Z") });
  assert.equal(first.length, 12);
  assert.ok(first.every((statement) => statement.currency === "EUR" && statement.rowCount === 0 && statement.revision === 1));
  assert.equal(creates, 12);
  await createSellerMonthlyStatementRevisions(db, { businessId: "biz_1", storeId: "store_1", now: new Date("2026-10-10T00:00:00Z") });
  assert.equal(creates, 12);
  await assert.rejects(() => createSellerMonthlyStatementRevisions(db, { businessId: "other", storeId: "store_1", now: new Date("2026-10-10T00:00:00Z") }), /STATEMENT_STORE_BUSINESS_MISMATCH/);
});
