import test from "node:test";
import assert from "node:assert/strict";
import { locales } from "../i18n/config";
import { sellerInvoiceArchiveCopy } from "../i18n/seller-invoice-archive";
import { loadSellerInvoiceArchive, safeStripeInvoiceUrl, SellerInvoiceArchiveError } from "../lib/seller-invoice-archive";

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: "in_123456", object: "invoice", customer: "cus_store_1", subscription: "sub_store_1", status: "paid", paid: true,
  created: 1_791_000_000, amount_paid: 1499, currency: "eur",
  hosted_invoice_url: "https://invoice.stripe.com/i/acct_safe/in_safe", invoice_pdf: null, number: "INV-001", ...overrides,
});

test("invoice archive is resolved only through the authenticated SellerBusiness owner and retains closed-owner lookup", async () => {
  let query: any;
  const db = { sellerBusiness: { findUnique: async (args: any) => { query = args; return { billingStore: { stripeCustomerId: "cus_store_1", subscription: { stripeSubscriptionId: "sub_store_1" } } }; } } } as any;
  let providerCalls = 0;
  const page = await loadSellerInvoiceArchive({ db, ownerId: "former-seller", listInvoices: async (customer, subscription, cursor, limit) => {
    providerCalls++;
    assert.equal(customer, "cus_store_1"); assert.equal(cursor, null); assert.equal(limit, 100);
    assert.equal(subscription, "sub_store_1");
    return { data: [invoice()] as any, has_more: false };
  } });
  assert.deepEqual(query.where, { ownerId: "former-seller" });
  assert.deepEqual(query.select, { billingStore: { select: { stripeCustomerId: true, subscription: { select: { stripeSubscriptionId: true } } } } });
  assert.equal("sellerClosedAt" in query.where, false);
  assert.equal(providerCalls, 1);
  assert.equal(page.invoices.length, 1);
  assert.equal(page.invoices[0].currency, "EUR");
  assert.equal(page.invoices[0].amountPaid, 1499);
  assert.equal(page.invoices[0].invoiceUrl, "https://invoice.stripe.com/i/acct_safe/in_safe");
});

test("invoice archive excludes unpaid, wrong-customer, invalid-host and malformed Stripe records", async () => {
  const db = { sellerBusiness: { findUnique: async () => ({ billingStore: { stripeCustomerId: "cus_store_1", subscription: { stripeSubscriptionId: "sub_store_1" } } }) } } as any;
  const result = await loadSellerInvoiceArchive({ db, ownerId: "owner", listInvoices: async () => ({ data: [
    invoice(), invoice({ id: "in_unpaid", paid: false, status: "open" }), invoice({ id: "in_other", customer: "cus_other" }),
    invoice({ id: "in_wrong_subscription", subscription: "sub_other" }), invoice({ id: "in_missing_subscription", subscription: null }),
    invoice({ id: "in_badurl", hosted_invoice_url: "https://evil.example/invoice" }), invoice({ id: "in_badamount", amount_paid: Number.MAX_SAFE_INTEGER + 1 }),
  ] as any, has_more: false }) });
  assert.deepEqual(result.invoices.map((item) => item.id), ["in_123456"]);
});

test("invoice archive returns a bounded Stripe cursor and rejects forged cursors before provider access", async () => {
  const db = { sellerBusiness: { findUnique: async () => ({ billingStore: { stripeCustomerId: "cus_store_1", subscription: { stripeSubscriptionId: "sub_store_1" } } }) } } as any;
  let called = false;
  const page = await loadSellerInvoiceArchive({ db, ownerId: "owner", listInvoices: async (_customer, subscription, cursor) => { called = true; assert.equal(subscription, "sub_store_1"); assert.equal(cursor, null); return { data: [invoice({ id: "in_654321" })] as any, has_more: true }; } });
  assert.equal(page.nextCursor, "in_654321");
  called = false;
  await assert.rejects(loadSellerInvoiceArchive({ db, ownerId: "owner", cursor: "cus_someone-else", listInvoices: async () => { called = true; return { data: [], has_more: false }; } }), (error) => error instanceof SellerInvoiceArchiveError && error.code === "INVALID_CURSOR");
  assert.equal(called, false);
});

test("missing billing history does not call Stripe and provider errors are safely normalized", async () => {
  let calls = 0;
  const noBilling = { sellerBusiness: { findUnique: async () => ({ billingStore: { stripeCustomerId: null, subscription: { stripeSubscriptionId: "sub_store_1" } } }) } } as any;
  assert.deepEqual(await loadSellerInvoiceArchive({ db: noBilling, ownerId: "owner", listInvoices: async () => { calls++; return { data: [], has_more: false }; } }), { invoices: [], nextCursor: null });
  assert.equal(calls, 0);
  const db = { sellerBusiness: { findUnique: async () => ({ billingStore: { stripeCustomerId: "cus_store_1", subscription: { stripeSubscriptionId: "sub_store_1" } } }) } } as any;
  await assert.rejects(loadSellerInvoiceArchive({ db, ownerId: "owner", listInvoices: async () => { throw new Error("secret diagnostic"); } }), (error) => error instanceof SellerInvoiceArchiveError && error.code === "INVOICE_PROVIDER_UNAVAILABLE" && !error.message.includes("secret"));
});

test("invoice links accept only HTTPS Stripe-hosted invoice and PDF URLs", () => {
  assert.equal(safeStripeInvoiceUrl("https://invoice.stripe.com/i/acct/id"), "https://invoice.stripe.com/i/acct/id");
  assert.equal(safeStripeInvoiceUrl("https://pay.stripe.com/invoice/acct/id/pdf"), "https://pay.stripe.com/invoice/acct/id/pdf");
  assert.equal(safeStripeInvoiceUrl("http://invoice.stripe.com/i/id"), null);
  assert.equal(safeStripeInvoiceUrl("https://evil.example/invoice"), null);
});

test("invoice archive copy has all 14 locale keys and preserves the approved French and English", () => {
  const keys = Object.keys(sellerInvoiceArchiveCopy("en")).sort();
  for (const locale of locales) {
    const copy = sellerInvoiceArchiveCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const key of keys) assert.ok(copy[key as keyof typeof copy], `${locale}.${key}`);
  }
  assert.equal(sellerInvoiceArchiveCopy("fr").title, "Factures d’abonnement");
  assert.equal(sellerInvoiceArchiveCopy("en").title, "Subscription invoices");
  assert.equal(sellerInvoiceArchiveCopy("fr").open, "Ouvrir la facture");
  assert.equal(sellerInvoiceArchiveCopy("en").open, "Open invoice");
});
