import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { extendManagedAccess } from "../lib/admin-access";
import { processStripeEvent } from "../lib/payments";
import { publicProductAccessWhere } from "../lib/admin-access";
import type { StripeEvent, StripeSubscription } from "../lib/stripe";

const databaseUrl = process.env.SELLER_DASHBOARD_TEST_DATABASE_URL;
const disposable = process.env.TODIJO_CI_DISPOSABLE_DATABASE === "1" && databaseUrl !== undefined && (() => {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname === "127.0.0.1" && parsed.username === "validation" && parsed.pathname === "/todijo_dashboard_test";
  } catch { return false; }
})();
const db = disposable && databaseUrl ? new PrismaClient({ datasources: { db: { url: databaseUrl } } }) : null;

async function createPendingSeller(plan: "admin-pro" | "paid-pro", suffix: string) {
  if (!db) throw new Error("Disposable seller activation database is unavailable.");
  const ownerId = `activation-owner-${plan}-${suffix}`;
  const storeId = `activation-store-${plan}-${suffix}`;
  const businessId = `activation-business-${plan}-${suffix}`;
  const adminId = `activation-admin-${plan}-${suffix}`;
  const stripeAccountId = `acct_activation_${plan.replaceAll("-", "_")}_${suffix}`;
  await db.$transaction(async tx => {
    await tx.user.create({ data: { id: ownerId, firstName: "Activation", lastName: plan, email: `${ownerId}@e2e.todijo.test`, role: "SELLER", emailVerified: true, stripeAccountId, stripeOnboardingComplete: plan === "paid-pro", stripeChargesEnabled: plan === "paid-pro", stripePayoutsEnabled: plan === "paid-pro" } });
    await tx.user.create({ data: { id: adminId, firstName: "Activation", lastName: "Admin", email: `${adminId}@e2e.todijo.test`, role: "ADMIN", emailVerified: true } });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId, primaryStoreId: storeId, billingStoreId: storeId, maxStores: 3 } });
    await tx.store.create({ data: {
      id: storeId, name: `Activation ${plan} ${suffix}`, slug: `activation-${plan}-${suffix}`, ownerId, businessId,
      country: "FR", city: "Paris", businessAddress: "10 rue de test", businessPostalCode: "75001", contactEmail: `${ownerId}@e2e.todijo.test`,
      status: "PENDING", sellerType: "PRIVATE", sellerLegalForm: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
      onboardingStatus: "VERIFIED", onboardingStep: 4,
      ...(plan === "paid-pro" ? { stripeCustomerId: `cus_activation_${suffix}` } : {}),
    } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId: storeId } });
    await tx.product.create({ data: { id: `activation-product-${plan}-${suffix}`, storeId, name: `Activation product ${suffix}`, slug: `activation-product-${plan}-${suffix}`, description: "Disposable seller activation fixture", price: 12, currency: "EUR", category: "test", condition: "NEUF", images: [], stock: 3, status: "PUBLISHED", dataClass: "PRODUCTION" } });
  });
  return { ownerId, storeId, businessId, adminId, stripeAccountId, productId: `activation-product-${plan}-${suffix}` };
}

async function removeFixture(fixture: Awaited<ReturnType<typeof createPendingSeller>>) {
  if (!db) return;
  await db.$transaction(async tx => {
    await tx.product.deleteMany({ where: { storeId: fixture.storeId } });
    await tx.sellerSubscription.deleteMany({ where: { storeId: fixture.storeId } });
    await tx.storeAccessGrant.deleteMany({ where: { storeId: fixture.storeId } });
    await tx.user.updateMany({ where: { id: fixture.ownerId, primaryStoreId: fixture.storeId }, data: { primaryStoreId: null } });
    await tx.sellerBusiness.updateMany({ where: { id: fixture.businessId, primaryStoreId: fixture.storeId }, data: { primaryStoreId: null } });
    await tx.store.deleteMany({ where: { id: fixture.storeId } });
    await tx.sellerBusiness.deleteMany({ where: { id: fixture.businessId } });
    await tx.user.deleteMany({ where: { id: { in: [fixture.ownerId, fixture.adminId] } } });
  });
}

test("Admin-granted PRO stays pending until fresh Connect readiness, then activates and becomes publicly eligible", { skip: !disposable }, async () => {
  assert.ok(db);
  const fixture = await createPendingSeller("admin-pro", randomUUID().slice(0, 8));
  try {
    const now = new Date();
    await db.$transaction(tx => extendManagedAccess(tx, fixture.adminId, [fixture.storeId], 3, now, "pro"), { isolationLevel: "Serializable" });
    assert.equal((await db.store.findUniqueOrThrow({ where: { id: fixture.storeId }, select: { status: true } })).status, "PENDING", "an Admin grant must not bypass Connect readiness");

    const event: StripeEvent = { id: `evt_activation_${fixture.ownerId}`, type: "account.updated", data: { object: { id: fixture.stripeAccountId, object: "account" } as never } };
    const readyAccount = { id: fixture.stripeAccountId, object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: true };
    const result = await processStripeEvent(db as never, event, undefined, undefined, undefined, async () => readyAccount as never);
    assert.deepEqual(result, { accountUpdated: true, storesActivated: true });
    const activeStore = await db.store.findUniqueOrThrow({ where: { id: fixture.storeId }, select: { status: true, marketplaceActivatedAt: true } });
    assert.equal(activeStore.status, "ACTIVE");
    assert.ok(activeStore.marketplaceActivatedAt);
    assert.equal(await db.product.count({ where: { ...publicProductAccessWhere(new Date()), id: fixture.productId } }), 1, "the seller listing becomes public only after all gates pass");
  } finally { await removeFixture(fixture); }
});

test("paid PRO subscription webhook activates a legally verified store when it is the final gate", { skip: !disposable }, async () => {
  assert.ok(db);
  const fixture = await createPendingSeller("paid-pro", randomUUID().slice(0, 8));
  const previousPrice = process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID;
  const priceId = `price_activation_${randomUUID().replaceAll("-", "")}`;
  process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = priceId;
  try {
    const start = Math.floor(Date.now() / 1000) - 60;
    const end = start + 30 * 24 * 60 * 60;
    const subscription = { id: `sub_activation_${fixture.ownerId}`, object: "subscription", customer: `cus_activation_${fixture.ownerId.slice(-8)}`, status: "active", cancel_at_period_end: false, current_period_start: start, current_period_end: end, items: { data: [{ price: { id: priceId }, current_period_start: start, current_period_end: end }] }, metadata: { storeId: fixture.storeId } } as unknown as StripeSubscription;
    const event: StripeEvent = { id: `evt_paid_activation_${fixture.ownerId}`, type: "customer.subscription.updated", data: { object: subscription } };
    const result = await processStripeEvent(db as never, event, async () => subscription);
    assert.deepEqual(result, { subscriptionUpdated: true, storeId: fixture.storeId, status: "ACTIVE" });
    const activeStore = await db.store.findUniqueOrThrow({ where: { id: fixture.storeId }, select: { status: true, marketplaceActivatedAt: true } });
    assert.equal(activeStore.status, "ACTIVE");
    assert.ok(activeStore.marketplaceActivatedAt);
    assert.equal(await db.product.count({ where: { ...publicProductAccessWhere(new Date()), id: fixture.productId } }), 1);
  } finally {
    if (previousPrice === undefined) delete process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID;
    else process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = previousPrice;
    await removeFixture(fixture);
  }
});

test.after(async () => { await db?.$disconnect(); });
