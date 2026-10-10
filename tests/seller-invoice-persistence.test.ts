import test from "node:test";
import assert from "node:assert/strict";
import { persistPaidSellerInvoice } from "../lib/seller-invoice-persistence";

const paid = { id: "in_real", object: "invoice", customer: "cus_billing", subscription: "sub_replaced", status: "paid", paid: true, created: 1_791_000_000, amount_paid: 1499, currency: "eur", number: "INV-real", hosted_invoice_url: "https://invoice.stripe.com/i/acct/in_real", invoice_pdf: null } as const;

test("invoice webhook persists immutable actual Stripe data against the stable billing business", async () => {
  let created: any;
  let update: unknown;
  const db = {
    store: { findFirst: async (args: any) => { assert.deepEqual(args.where, { stripeCustomerId: "cus_billing" }); return { id: "store_billing", businessId: "biz_1", business: { billingStoreId: "store_billing" } }; } },
    sellerBusinessInvoice: { upsert: async (args: any) => { created = args.create; update = args.update; } },
  } as any;
  assert.equal(await persistPaidSellerInvoice(db, { id: "evt_paid" }, paid), true);
  assert.equal(created.businessId, "biz_1");
  assert.equal(created.stripeSubscriptionId, "sub_replaced");
  assert.equal(created.stripeInvoiceId, "in_real");
  assert.equal(created.amountPaidMinor, BigInt(1499));
  assert.equal(created.currency, "EUR");
  assert.equal(created.createdAt.getTime(), paid.created * 1000);
  assert.deepEqual(update, {});
});

test("invoice webhook does not archive unpaid, malformed, or non-billing-store invoices", async () => {
  let writes = 0;
  const db = { store: { findFirst: async () => ({ id: "store_secondary", businessId: "biz_1", business: { billingStoreId: "store_billing" } }) }, sellerBusinessInvoice: { upsert: async () => { writes++; } } } as any;
  assert.equal(await persistPaidSellerInvoice(db, { id: "evt_unpaid" }, { ...paid, paid: false, status: "open" }), false);
  assert.equal(await persistPaidSellerInvoice(db, { id: "evt_secondary" }, paid), false);
  assert.equal(writes, 0);
});
