import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { processStripeEvent } from "../../lib/payments";
import { publicProductAccessWhere } from "../../lib/admin-access";
import type { StripeEvent, StripeSubscription } from "../../lib/stripe";
import { reconcilePendingSellerStoreActivation } from "../../lib/seller-store-activation";

const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
const allowedDatabase = (() => {
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !databaseUrl) return false;
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname === "127.0.0.1" && parsed.username === "validation" && parsed.pathname === "/todijo_browser";
  } catch { return false; }
})();
if (!allowedDatabase || !databaseUrl) throw new Error("Seller activation browser tests require the dedicated disposable Playwright database.");

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = randomUUID().slice(0, 8);
const adminId = `activation-browser-admin-${suffix}`;

async function createSeller(plan: "admin" | "paid" | "review") {
  const fixtureSuffix = randomUUID().slice(0, 8);
  const ownerId = `activation-browser-${plan}-${fixtureSuffix}`;
  const businessId = `activation-business-${plan}-${fixtureSuffix}`;
  const storeId = `activation-store-${plan}-${fixtureSuffix}`;
  const primaryStoreId = plan === "paid" ? `activation-primary-${fixtureSuffix}` : storeId;
  const slug = `activation-${plan}-${fixtureSuffix}`;
  const productId = `activation-product-${plan}-${fixtureSuffix}`;
  const productName = `Activation product ${plan} ${fixtureSuffix}`;
  const stripeAccountId = `acct_activation_${plan}_${fixtureSuffix}`;
  await db.$transaction(async tx => {
    await tx.user.create({ data: {
      id: ownerId, firstName: "Activation", lastName: plan, email: `${ownerId}@e2e.todijo.test`, role: "SELLER", emailVerified: true,
      ...(plan !== "review" ? { stripeAccountId } : {}),
      ...(plan === "paid" ? { stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } : {}),
    } });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId, maxStores: 3 } });
    if (plan === "paid") {
      await tx.store.create({ data: {
        id: primaryStoreId, name: `Activation primary ${fixtureSuffix}`, slug: `activation-primary-${fixtureSuffix}`, ownerId, businessId,
        country: "FR", city: "Paris", businessAddress: "10 rue de test", businessPostalCode: "75001", contactEmail: `${ownerId}@e2e.todijo.test`,
        status: "ACTIVE", marketplaceActivatedAt: new Date(), sellerType: "PRIVATE", sellerLegalForm: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
        onboardingStatus: "VERIFIED", onboardingStep: 4, stripeCustomerId: `cus_activation_${fixtureSuffix}`,
      } });
    }
    await tx.store.create({ data: {
      id: storeId, name: `Activation ${plan} ${fixtureSuffix}`, slug, ownerId, businessId,
      country: "FR", city: "Paris", businessAddress: "10 rue de test", businessPostalCode: "75001", contactEmail: `${ownerId}@e2e.todijo.test`,
      status: "PENDING", sellerType: "PRIVATE", sellerLegalForm: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
      onboardingStatus: plan === "review" ? "PENDING_REVIEW" : "PENDING_REVIEW", onboardingStep: 4,
    } });
    await tx.sellerBusiness.update({ where: { id: businessId }, data: { primaryStoreId, billingStoreId: primaryStoreId } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId } });
    await tx.product.create({ data: {
      id: productId, storeId, name: productName, slug: `activation-product-${plan}-${fixtureSuffix}`,
      description: "Synthetic seller activation fixture", price: 12, currency: "EUR", category: "test", condition: "NEUF", images: [], stock: 3,
      status: "PUBLISHED", dataClass: "PRODUCTION",
    } });
  });
  return { ownerId, businessId, storeId, primaryStoreId, slug, productId, productName, stripeAccountId, customerId: `cus_activation_${fixtureSuffix}` };
}

test.beforeAll(async () => {
  await db.user.create({ data: { id: adminId, firstName: "Activation", lastName: "Admin", email: `activation-admin-${suffix}@e2e.todijo.test`, role: "ADMIN", emailVerified: true } });
});

async function authenticate(page: Page, userId: string, role: "SELLER" | "ADMIN") {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { authVersion: true } });
  const token = await new SignJWT({ userId, role, authVersion: user.authVersion })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value: token, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

async function sellerCanSell(page: Page, store: Awaited<ReturnType<typeof createSeller>>) {
  await authenticate(page, store.ownerId, "SELLER");
  const dashboard = await page.goto("/en/dashboard");
  expect(dashboard?.status()).toBe(200);
  await expect(page.locator(".dashboardSkeleton")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const storefront = await page.goto(`/en/store/${store.slug}`);
  expect(storefront?.status()).toBe(200);
  await expect(page.getByText(store.productName)).toBeVisible();
}

test("Admin review decision persists its audit reason and rejected approval returns the exact prerequisite code", async ({ page }) => {
  const store = await createSeller("review");
  await db.store.update({ where: { id: store.storeId }, data: { businessPostalCode: null } });
  await authenticate(page, adminId, "ADMIN");
  await page.goto("/en/dashboard");

  const rejectedApproval = await page.evaluate(async storeId => {
    const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ status: "VERIFIED", reason: "Attempted review before required evidence was present" }),
    });
    return { status: response.status, body: await response.json() };
  }, store.storeId);
  expect(rejectedApproval).toEqual({ status: 409, body: { error: "SELLER_PREREQUISITES_INCOMPLETE" } });
  expect(await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { onboardingStatus: true, status: true } }))
    .toEqual({ onboardingStatus: "PENDING_REVIEW", status: "PENDING" });

  const reason = `Please provide the missing seller evidence ${suffix}`;
  const decision = await page.evaluate(async ({ storeId, reason }) => {
    const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ status: "NEEDS_INFORMATION", reason }),
    });
    return { status: response.status, body: await response.json() };
  }, { storeId: store.storeId, reason });
  expect(decision).toMatchObject({ status: 200, body: { ok: true, changed: true, status: "NEEDS_INFORMATION" } });
  expect(await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { onboardingStatus: true, status: true } }))
    .toEqual({ onboardingStatus: "NEEDS_INFORMATION", status: "PENDING" });
  const audit = await db.sellerBusinessAuditEvent.findFirstOrThrow({ where: { storeId: store.storeId, action: "SELLER_NEEDS_INFORMATION" }, select: { actorId: true, metadata: true } });
  expect(audit.actorId).toBe(adminId);
  expect(audit.metadata).toMatchObject({ reason });

  await authenticate(page, store.ownerId, "SELLER");
  await page.goto("/en/seller/onboarding");
  await expect(page.getByRole("status").getByText(reason)).toBeVisible();
});

test("Admin-granted PRO activates only after a fresh ready Connect state, then seller dashboard and listing render", async ({ page }) => {
  const store = await createSeller("admin");
  await authenticate(page, adminId, "ADMIN");
  await page.goto("/en/dashboard");
  const approval = await page.evaluate(async storeId => {
    const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ status: "VERIFIED", reason: "Private seller details reviewed" }),
    });
    return { status: response.status, body: await response.json() };
  }, store.storeId);
  expect(approval).toMatchObject({ status: 200, body: { ok: true, changed: true, status: "VERIFIED", activation: { activated: false, reason: "STRIPE_CONNECT_NOT_READY" } } });
  expect((await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true } })).status).toBe("PENDING");

  const grant = await page.evaluate(async storeId => {
    const response = await fetch("/api/admin/stores", {
      method: "PATCH", headers: { "content-type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ storeIds: [storeId], months: 3, plan: "pro" }),
    });
    return { status: response.status, body: await response.json() };
  }, store.storeId);
  expect(grant.status, JSON.stringify(grant.body)).toBe(200);
  expect((await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true } })).status).toBe("PENDING");

  const connectEvent: StripeEvent = { id: `evt_activation_browser_${suffix}`, type: "account.updated", data: { object: { id: store.stripeAccountId, object: "account" } as never } };
  const readyAccount = { id: store.stripeAccountId, object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: true };
  expect(await processStripeEvent(db as never, connectEvent, undefined, undefined, undefined, async () => readyAccount as never))
    .toEqual({ accountUpdated: true, storesActivated: true });
  expect(await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true, onboardingStatus: true } }))
    .toEqual({ status: "ACTIVE", onboardingStatus: "VERIFIED" });
  expect(await db.product.count({ where: { ...publicProductAccessWhere(new Date()), id: store.productId } })).toBe(1);
  await sellerCanSell(page, store);
});

test("paid PRO subscription state is the final activation gate and makes the store purchasable", async ({ page }) => {
  const store = await createSeller("paid");
  await authenticate(page, adminId, "ADMIN");
  await page.goto("/en/dashboard");
  const approval = await page.evaluate(async storeId => {
    const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ status: "VERIFIED", reason: "Paid seller setup information verified" }),
    });
    return { status: response.status, body: await response.json() };
  }, store.storeId);
  expect(approval).toMatchObject({ status: 200, body: { ok: true, changed: true, status: "VERIFIED", activation: { activated: false, reason: "COMMERCIAL_ENTITLEMENT_INACTIVE" } } });
  const previousPrice = process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID;
  const priceId = `price_activationbrowser${randomUUID().replaceAll("-", "")}`;
  process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = priceId;
  try {
    const start = Math.floor(Date.now() / 1000) - 60;
    const end = start + 30 * 24 * 60 * 60;
    const subscription = {
      id: `sub_activation_browser_${suffix}`, object: "subscription", customer: store.customerId, status: "active", cancel_at_period_end: false,
      current_period_start: start, current_period_end: end,
      items: { data: [{ price: { id: priceId }, current_period_start: start, current_period_end: end }] },
      // The paid plan is business-level and belongs to the canonical billing
      // store. Its webhook must reconcile the verified secondary store too.
      metadata: { storeId: store.primaryStoreId },
    } as unknown as StripeSubscription;
    const event: StripeEvent = { id: `evt_paid_activation_browser_${suffix}`, type: "customer.subscription.updated", data: { object: subscription } };
    expect(await processStripeEvent(db as never, event, async () => subscription))
      .toEqual({ subscriptionUpdated: true, storeId: store.primaryStoreId, status: "ACTIVE" });
  } finally {
    if (previousPrice === undefined) delete process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID;
    else process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = previousPrice;
  }
  expect(await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true, onboardingStatus: true } }))
    .toEqual({ status: "ACTIVE", onboardingStatus: "VERIFIED" });
  expect(await db.product.count({ where: { ...publicProductAccessWhere(new Date()), id: store.productId } })).toBe(1);
  await sellerCanSell(page, store);
});

test("an otherwise eligible FREE primary store remains pending until all Connect capabilities are ready", async () => {
  const store = await createSeller("admin");
  await db.store.update({ where: { id: store.storeId }, data: { onboardingStatus: "VERIFIED" } });
  const missingConnect = await db.$transaction(tx => reconcilePendingSellerStoreActivation(tx, store.storeId));
  expect(missingConnect).toMatchObject({ activated: false, reason: "STRIPE_CONNECT_NOT_READY" });
  expect((await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true } })).status).toBe("PENDING");
  await db.user.update({ where: { id: store.ownerId }, data: { stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } });
  expect(await db.$transaction(tx => reconcilePendingSellerStoreActivation(tx, store.storeId)))
    .toMatchObject({ activated: true, reason: "ACTIVATED" });
  expect((await db.store.findUniqueOrThrow({ where: { id: store.storeId }, select: { status: true } })).status).toBe("ACTIVE");
});

test.afterAll(async () => { await db.$disconnect(); });
