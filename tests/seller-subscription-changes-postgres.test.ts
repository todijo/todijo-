import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { requestSellerSubscriptionChange, type subscriptionChangeProviders } from "../lib/seller-subscription-changes";
import type { StripeSubscription } from "../lib/stripe";
import { processStripeEvent } from "../lib/payments";

const databaseUrl = process.env.SELLER_SUBSCRIPTION_TRANSITION_TEST_DATABASE_URL;
test("PostgreSQL advisory locking and partial uniqueness prevent concurrent live change attempts", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "65431");
  assert.equal(target.pathname, "/todijo_transition_test"); assert.equal(target.username, "validation");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const keys = ["STRIPE_SELLER_BASIC_MONTHLY_PRICE_ID", "STRIPE_SELLER_PRO_MONTHLY_PRICE_ID"];
  const previous = keys.map(key => process.env[key]);
  process.env[keys[0]] = "price_basicmonthly"; process.env[keys[1]] = "price_promonthly";
  try {
    const migrations = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '20261004010000_add_seller_subscription_changes' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    assert.equal(Number(migrations[0].count), 1);
    const seller = await db.user.create({ data: { email: "transition-test@example.invalid", firstName: "Test", lastName: "Seller", role: "SELLER" } });
    const store = await db.store.create({ data: { name: "Transition test", slug: "transition-test", ownerId: seller.id, country: "FR", city: "Paris", contactEmail: seller.email, stripeCustomerId: "cus_test" } });
    const now = new Date(), end = new Date(Math.ceil(now.getTime() / 1000) * 1000 + 30 * 86400_000);
    const subscription = await db.sellerSubscription.create({ data: { storeId: store.id, stripeSubscriptionId: "sub_test", stripePriceId: "price_basicmonthly", plan: "basic", billingInterval: "monthly", status: "ACTIVE", currentPeriodEnd: end } });
    const live: StripeSubscription = { id: "sub_test", object: "subscription", customer: "cus_test", status: "active", collection_method: "charge_automatically", current_period_end: end.getTime() / 1000, items: { data: [{ id: "si_test", price: { id: "price_basicmonthly" }, quantity: 1 }] } };
    let writes = 0;
    const unexpected = async (): Promise<never> => { throw new Error("Unexpected provider operation"); };
    const providers: typeof subscriptionChangeProviders = { retrieve: async () => structuredClone(live), invoice: async () => ({ id: "in_test", object: "invoice", paid: false }),
      upgrade: async () => { writes++; live.pending_update = { expires_at: now.getTime() / 1000 + 3600 }; live.latest_invoice = { id: "in_test", object: "invoice", paid: false, billing_reason: "subscription_update", created: Math.floor(now.getTime() / 1000) }; return structuredClone(live); },
      schedule: unexpected, createSchedule: unexpected, configureSchedule: unexpected, release: unexpected };
    const input = { db, storeId: store.id, userId: seller.id, planId: "pro", interval: "monthly", providers, now };
    const results = await Promise.all([requestSellerSubscriptionChange(input), requestSellerSubscriptionChange(input)]);
    assert.equal(results[0].id, results[1].id); assert.equal(writes, 1);
    assert.equal(await db.sellerSubscriptionChange.count(), 1);
    const copy = { ...results[0], id: undefined, createdAt: undefined, updatedAt: undefined };
    await assert.rejects(() => db.sellerSubscriptionChange.create({ data: { ...copy, stripeInvoiceId: null, status: "PREPARED" } }), (error: any) => error.code === "P2002");
    const product = await db.product.create({ data: { storeId: store.id, name: "Preserved product", slug: "preserved-product", description: "Disposable test fixture", price: 10, category: "test", condition: "NEUF", images: [], status: "PUBLISHED" } });
    const invoiceEvent = { id: "evt_upgrade_failure", type: "invoice.payment_failed", data: { object: { id: "in_test", object: "invoice" as const, subscription: "sub_test" } } };
    const unusedCheckout = async (): Promise<never> => { throw new Error("Unexpected Checkout retrieval"); };
    await processStripeEvent(db, invoiceEvent, providers.retrieve, unusedCheckout, providers);
    assert.equal((await db.sellerSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).plan, "basic");
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).status, "PUBLISHED");
    live.pending_update = null; live.items!.data![0].price = { id: "price_promonthly" };
    live.latest_invoice = { id: "in_test", object: "invoice", subscription: "sub_test", paid: true, status: "paid", billing_reason: "subscription_update", created: Math.floor(now.getTime() / 1000) };
    const paidEvent = { ...invoiceEvent, id: "evt_upgrade_paid", type: "invoice.paid" };
    await processStripeEvent(db, paidEvent, providers.retrieve, unusedCheckout, providers);
    assert.equal((await db.sellerSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).plan, "pro");
    assert.deepEqual(await processStripeEvent(db, paidEvent, providers.retrieve, unusedCheckout, providers), { duplicate: true });
    await processStripeEvent(db, { ...invoiceEvent, id: "evt_late_failed" }, providers.retrieve, unusedCheckout, providers);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).status, "PUBLISHED");
    assert.equal((await db.sellerSubscriptionChange.findUniqueOrThrow({ where: { id: results[0].id } })).status, "APPLIED");
    await assert.rejects(() => processStripeEvent(db, { id: "evt_superseded_subscription", type: "customer.subscription.deleted", data: { object: { ...live, id: "sub_superseded", status: "canceled", items: { data: [{ price: { id: "price_basicmonthly" } }] } } } }, providers.retrieve, unusedCheckout, providers), /Superseded subscription/);
    assert.equal((await db.sellerSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).plan, "pro");
    await db.sellerSubscriptionChange.create({ data: { ...copy, stripeInvoiceId: null, status: "SCHEDULED", operation: "SCHEDULE" } });
    await assert.rejects(() => db.sellerSubscriptionChange.create({ data: { ...copy, stripeInvoiceId: null, status: "SCHEDULED", operation: "SCHEDULE" } }), (error: any) => error.code === "P2002");
    await assert.rejects(() => db.sellerSubscriptionChange.create({ data: { ...copy, status: "APPLIED" } }), (error: any) => error.code === "P2002");
    await assert.rejects(() => db.sellerSubscription.delete({ where: { id: subscription.id } }), (error: any) => error.code === "P2003");
    assert.equal((await db.sellerSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).plan, "pro");
  } finally {
    await db.$disconnect(); keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
