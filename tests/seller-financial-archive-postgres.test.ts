import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { createSellerMonthlyStatementRevisions } from "../lib/seller-monthly-statements";
import { loadSellerInvoiceArchive } from "../lib/seller-invoice-archive";
import { persistPaidSellerInvoice } from "../lib/seller-invoice-persistence";

const databaseUrl = process.env.SELLER_STATEMENT_TEST_DATABASE_URL;

test("PostgreSQL monthly statements are append-only/idempotent and subscription invoices survive replacement, provider outage, and closure", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "65431");
  assert.equal(target.username, "validation");
  assert.equal(target.password, "validation");
  assert.equal(target.pathname, "/todijo_statement_test");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const marker = `seller-finance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let ownerId = ""; let buyerId = ""; let businessId = ""; let storeId = ""; let orderId = ""; let usdOrderId = "";
  try {
    const owner = await db.user.create({ data: { firstName: "Finance", lastName: "Owner", email: `${marker}-owner@example.invalid`, role: "SELLER" } }); ownerId = owner.id;
    const buyer = await db.user.create({ data: { firstName: "Finance", lastName: "Buyer", email: `${marker}-buyer@example.invalid` } }); buyerId = buyer.id;
    const business = await db.sellerBusiness.create({ data: { ownerId: owner.id } }); businessId = business.id;
    const store = await db.store.create({ data: { name: marker, slug: marker, ownerId: owner.id, businessId: business.id, country: "FR", city: "Paris", contactEmail: owner.email, currency: "EUR", stripeCustomerId: `${marker}-cus`, createdAt: new Date("2025-01-01T00:00:00Z") } }); storeId = store.id;
    await db.sellerBusiness.update({ where: { id: business.id }, data: { billingStoreId: store.id } });
    const period = new Date(Date.UTC(2026, 8, 15, 12));
    const order = await db.order.create({ data: { buyerId: buyer.id, checkoutRequestId: `${marker}-eur`, status: "PAID", currency: "EUR", total: 20, paidAt: period } }); orderId = order.id;
    const group = await db.orderGroup.create({ data: { orderId: order.id, groupKey: `${marker}-eur-group`, kind: "MARKETPLACE", storeId: store.id, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 2000, shippingAmountMinor: 500, platformFeeAmountMinor: 200, sellerNetAmountMinor: 2300 } });
    const usdOrder = await db.order.create({ data: { buyerId: buyer.id, checkoutRequestId: `${marker}-usd`, status: "PAID", currency: "USD", total: 10, paidAt: period } }); usdOrderId = usdOrder.id;
    await db.orderGroup.create({ data: { orderId: usdOrder.id, groupKey: `${marker}-usd-group`, kind: "MARKETPLACE", storeId: store.id, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 1000, shippingAmountMinor: 0, platformFeeAmountMinor: 100, sellerNetAmountMinor: 900 } });

    const now = new Date("2026-10-10T00:00:00Z");
    const [first, concurrent] = await Promise.all([
      createSellerMonthlyStatementRevisions(db, { businessId: business.id, storeId: store.id, now }),
      createSellerMonthlyStatementRevisions(db, { businessId: business.id, storeId: store.id, now }),
    ]);
    assert.ok(first.some((statement) => statement.year === 2026 && statement.month === 9 && statement.currency === "EUR" && statement.rowCount === 1));
    assert.ok(first.some((statement) => statement.year === 2026 && statement.month === 9 && statement.currency === "USD" && statement.rowCount === 1));
    const euStatement = await db.sellerMonthlyStatement.findFirst({ where: { storeId: store.id, year: 2026, month: 9, currency: "EUR", revision: 1 } });
    assert.ok(euStatement);
    assert.equal((euStatement.snapshot as any).totals.merchandise, "2000");
    assert.equal((await db.sellerMonthlyStatement.count({ where: { storeId: store.id, year: 2026, month: 9, currency: "EUR" } })), 1);
    assert.ok(concurrent.some((statement) => statement.id === euStatement.id));

    await db.orderGroup.update({ where: { id: group.id }, data: { refundedCashMerchandiseMinor: 250 } });
    await createSellerMonthlyStatementRevisions(db, { businessId: business.id, storeId: store.id, now });
    const revisions = await db.sellerMonthlyStatement.findMany({ where: { storeId: store.id, year: 2026, month: 9, currency: "EUR" }, orderBy: { revision: "asc" } });
    assert.equal(revisions.length, 2);
    assert.equal(revisions[0].revision, 1);
    assert.equal((revisions[0].snapshot as any).totals.refunds, "0");
    assert.equal((revisions[1].snapshot as any).totals.refunds, "250");

    const paidInvoice = { id: `${marker}-in`, object: "invoice", customer: `${marker}-cus`, subscription: `${marker}-replaced-sub`, status: "paid", paid: true, created: Math.floor(period.getTime() / 1000), amount_paid: 1999, currency: "eur", number: `${marker}-number`, hosted_invoice_url: "https://invoice.stripe.com/i/acct_safe/synthetic", invoice_pdf: null } as const;
    assert.equal(await persistPaidSellerInvoice(db, { id: `${marker}-event` }, paidInvoice), true);
    assert.equal(await persistPaidSellerInvoice(db, { id: `${marker}-duplicate-event` }, paidInvoice), true);
    assert.equal(await db.sellerBusinessInvoice.count({ where: { businessId: business.id, stripeInvoiceId: paidInvoice.id } }), 1);
    await db.sellerBusiness.update({ where: { id: business.id }, data: { sellerClosedAt: now } });
    await db.user.update({ where: { id: owner.id }, data: { role: "CUSTOMER" } });
    const archive = await loadSellerInvoiceArchive({ db, ownerId: owner.id, listInvoices: async () => { throw new Error("Stripe intentionally unavailable in this test"); } });
    assert.equal(archive.invoices[0]?.id, paidInvoice.id);
    assert.equal(archive.invoices[0]?.amountPaid, 1999);
    assert.ok(await db.sellerMonthlyStatement.findUnique({ where: { id: euStatement.id } }), "closure preserves historical statements");
  } finally {
    if (storeId) {
      await db.sellerBusinessAuditEvent.deleteMany({ where: { businessId } });
      await db.sellerMonthlyStatement.deleteMany({ where: { storeId } });
      await db.sellerBusinessInvoice.deleteMany({ where: { businessId } });
      await db.order.deleteMany({ where: { id: { in: [orderId, usdOrderId].filter(Boolean) } } });
      await db.sellerBusiness.updateMany({ where: { id: businessId }, data: { billingStoreId: null } });
      await db.store.update({ where: { id: storeId }, data: { businessId: null } });
    }
    if (businessId) await db.sellerBusiness.deleteMany({ where: { id: businessId } });
    if (storeId) await db.store.deleteMany({ where: { id: storeId } });
    if (ownerId || buyerId) await db.user.deleteMany({ where: { id: { in: [ownerId, buyerId].filter(Boolean) } } });
    await db.$disconnect();
  }
});
