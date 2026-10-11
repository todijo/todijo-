import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = randomUUID().slice(0, 8);
const ownerId = `pro-multistore-owner-${suffix}`;
const adminId = `pro-multistore-admin-${suffix}`;
const buyerId = `pro-multistore-buyer-${suffix}`;
const businessId = `pro-multistore-business-${suffix}`;
const primaryId = `pro-multistore-primary-${suffix}`;
let store2Id = "";
let productId = "";
let orderId = "";
let orderGroupId = "";

async function addOwnerSession(page: import("@playwright/test").Page) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { authVersion: true } });
  const value = await new SignJWT({ userId: ownerId, role: "SELLER", authVersion: owner.authVersion })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

async function createStore(page: import("@playwright/test").Page, index: number) {
  return page.evaluate(async ({ suffix, index }) => {
    const name = `PRO Store ${index} ${suffix}`;
    const response = await fetch("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug: `pro-store-${index}-${suffix}`, contactEmail: `owner-${suffix}@e2e.todijo.test`, country: "France", city: "Paris", sellerType: "PRIVATE", currency: "EUR", language: "en" }),
    });
    return { status: response.status, body: await response.json() };
  }, { suffix, index });
}

test.beforeAll(async () => {
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
  if (process.env.TODIJO_CI_DISPOSABLE_DATABASE !== "1" || !databaseUrl) {
    throw new Error("PRO multi-store browser test requires the dedicated disposable Playwright database.");
  }
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (
    parsedDatabaseUrl.hostname !== "127.0.0.1" ||
    parsedDatabaseUrl.username !== "validation" ||
    parsedDatabaseUrl.pathname !== "/todijo_browser" ||
    parsedDatabaseUrl.port !== (process.env.PGPORT ?? "5432")
  ) {
    throw new Error("Refusing to run PRO multi-store browser test against a non-disposable database.");
  }

  await db.$transaction(async tx => {
    await tx.user.createMany({ data: [
      { id: ownerId, firstName: "PRO", lastName: "Owner", email: `owner-${suffix}@e2e.todijo.test`, role: "SELLER", emailVerified: true },
      { id: adminId, firstName: "Test", lastName: "Admin", email: `admin-${suffix}@e2e.todijo.test`, role: "ADMIN", emailVerified: true },
      { id: buyerId, firstName: "Test", lastName: "Buyer", email: `buyer-${suffix}@e2e.todijo.test`, role: "CUSTOMER", emailVerified: true },
    ] });
    await tx.store.create({ data: { id: primaryId, name: `PRO Primary ${suffix}`, slug: `pro-primary-${suffix}`, ownerId, country: "FR", city: "Paris", contactEmail: `owner-${suffix}@e2e.todijo.test`, status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", onboardingStatus: "VERIFIED", onboardingStep: 4 } });
    await tx.sellerBusiness.create({ data: { id: businessId, ownerId, primaryStoreId: primaryId, billingStoreId: primaryId, maxStores: 1 } });
    await tx.store.update({ where: { id: primaryId }, data: { businessId } });
    await tx.user.update({ where: { id: ownerId }, data: { primaryStoreId: primaryId } });
    await tx.storeAccessGrant.create({ data: { storeId: primaryId, grantedById: adminId, source: "ADMIN_GRANTED", plan: "pro", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 30 * 86_400_000) } });
  });
});

test.afterAll(async () => {
  // Fixtures are intentionally retained until the isolated browser database is
  // destroyed by validate-free-seller-postgres.mjs. Deleting stores here would
  // fight the primary-store foreign key and is unnecessary for a disposable DB.
  await db.$disconnect();
});

test("Admin-granted PRO creates stores 2 and 3, blocks store 4, and archives without losing product/order history", async ({ page }) => {
  test.setTimeout(90_000);
  await addOwnerSession(page);
  await page.goto("/en/dashboard");

  const second = await createStore(page, 2);
  expect(second.status, JSON.stringify(second.body)).toBe(200);
  store2Id = second.body.store.id;
  const third = await createStore(page, 3);
  expect(third.status).toBe(200);
  const fourth = await createStore(page, 4);
  expect(fourth.status).toBe(409);
  expect(fourth.body.error).toBe("STORE_LIMIT_REACHED");

  const business = await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId }, select: { primaryStoreId: true, billingStoreId: true } });
  expect(business).toEqual({ primaryStoreId: primaryId, billingStoreId: primaryId });
  expect(await db.sellerSubscription.count({ where: { store: { businessId } } })).toBe(0);
  productId = `pro-multistore-product-${suffix}`;
  const product = await db.product.create({ data: { id: productId, storeId: store2Id, name: `Archived product ${suffix}`, slug: `archived-product-${suffix}`, description: "Disposable browser fixture", price: 12, category: "test", condition: "NEUF", images: ["/fixture.png"], stock: 5, status: "PUBLISHED", shippingOverrideEnabled: false } });
  orderId = `pro-multistore-order-${suffix}`;
  await db.order.create({ data: { id: orderId, buyerId, checkoutRequestId: `pro-multistore-checkout-${suffix}`, status: "PAID", currency: "EUR", total: 12 } });
  orderGroupId = `pro-multistore-group-${suffix}`;
  await db.orderGroup.create({ data: { id: orderGroupId, orderId, groupKey: `pro-multistore-group-key-${suffix}`, kind: "MARKETPLACE", storeId: store2Id, storeIdSnapshot: store2Id, storeNameSnapshot: second.body.store.slug, maturitySnapshot: "STANDARD", maturityEvidence: {}, itemSubtotalMinor: 1200, shippingAmountMinor: 0, platformFeeAmountMinor: 120, sellerNetAmountMinor: 1080 } });
  await db.orderItem.create({ data: { orderId, orderGroupId, productId, quantity: 1, unitPrice: 12, lineTotal: 12, productNameSnapshot: product.name, currency: "EUR" } });

  const response = await page.goto("/en/dashboard");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back, PRO" })).toBeVisible();
  const managementCards = page.locator(".sellerStoreManagementCard");
  await expect(managementCards.filter({ hasText: `PRO Primary ${suffix}` })).toBeVisible();
  await expect(managementCards.filter({ hasText: `PRO Store 2 ${suffix}` })).toBeVisible();
  await expect(managementCards.filter({ hasText: `PRO Store 3 ${suffix}` })).toBeVisible();

  page.on("dialog", dialog => dialog.accept());
  const storeCard = page.locator(".sellerStoreManagementCard").filter({ hasText: `PRO Store 2 ${suffix}` });
  await storeCard.getByRole("button", { name: "Archive store" }).click();
  await expect(page.getByRole("status")).toContainText("Store archived");

  const archived = await db.store.findUniqueOrThrow({ where: { id: store2Id }, select: { status: true, archivedAt: true } });
  expect(archived.status).toBe("SUSPENDED");
  expect(archived.archivedAt).not.toBeNull();
  const moved = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { storeId: true, status: true, stock: true } });
  expect(moved).toEqual({ storeId: primaryId, status: "DRAFT", stock: 5 });
  const historical = await db.orderGroup.findUniqueOrThrow({ where: { id: orderGroupId }, select: { storeId: true, storeIdSnapshot: true } });
  expect(historical).toEqual({ storeId: store2Id, storeIdSnapshot: store2Id });

  const primaryArchive = await page.evaluate(async primaryId => {
    const response = await fetch(`/api/seller/stores/${encodeURIComponent(primaryId)}/archive`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
    return { status: response.status, body: await response.json() };
  }, primaryId);
  expect(primaryArchive.status).toBe(409);
  expect(primaryArchive.body.error).toBe("PRIMARY_STORE_CANNOT_BE_ARCHIVED");
});
