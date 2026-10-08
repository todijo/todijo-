import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { hashAuthToken } from "../../lib/auth-token-crypto";
import { sellerLifecycleCopy } from "../../i18n/seller-lifecycle";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userId = `phase3-lifecycle-${suffix}`;
const storeId = `phase3-lifecycle-store-${suffix}`;
const businessId = `phase3-lifecycle-business-${suffix}`;
const productId = `phase3-lifecycle-product-${suffix}`;
const orderId = `phase3-lifecycle-order-${suffix}`;
const rawToken = randomBytes(32).toString("base64url");
const trialGrantedAt = new Date("2026-06-01T00:00:00.000Z");
const trialEnd = new Date("2026-09-01T00:00:00.000Z");
const periodEnd = new Date(Date.now() + 21 * 86_400_000);

async function addSession(page: import("@playwright/test").Page) {
  const value = await new SignJWT({ userId, role: "SELLER", authVersion: 0 })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value, url: "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

test.beforeAll(async () => {
  await db.user.create({ data: { id: userId, firstName: "Lifecycle", lastName: "Seller", email: `${suffix}@phase3.invalid`, role: "SELLER", emailVerified: true, authVersion: 0 } });
  await db.sellerBusiness.create({ data: { id: businessId, ownerId: userId, maxStores: 3, firstPaidTrialGrantedAt: trialGrantedAt } });
  await db.store.create({ data: { id: storeId, name: `Lifecycle store ${suffix}`, slug: `phase3-${suffix}`, country: "FR", city: "Paris", contactEmail: `${suffix}@phase3.invalid`, ownerId: userId, businessId, status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", onboardingStatus: "VERIFIED", onboardingStep: 4 } });
  await db.sellerBusiness.update({ where: { id: businessId }, data: { billingStoreId: storeId } });
  await db.user.update({ where: { id: userId }, data: { primaryStoreId: storeId } });
  await db.sellerSubscription.create({ data: { id: `phase3-lifecycle-sub-${suffix}`, storeId, plan: "pro", billingInterval: "monthly", stripePriceId: "price_phase3_mock_pro", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 9 * 86_400_000), currentPeriodEnd: periodEnd, trialEnd, cancelAtPeriodEnd: true } });
  await db.product.create({ data: { id: productId, storeId, name: "Lifecycle test product", slug: `phase3-product-${suffix}`, description: "Disposable lifecycle fixture", price: 19, category: "test", condition: "NEUF", images: ["/fixture.png"], status: "PUBLISHED", complianceDeclaredAt: new Date() } });
  await db.order.create({ data: { id: orderId, buyerId: userId, status: "CANCELLED", currency: "EUR", total: 19, checkoutRequestId: `phase3-history-${suffix}`, sellerInvoiceReference: `INV-PHASE3-${suffix}`, sellerInvoiceUrl: `https://documents.invalid/phase3/${suffix}.pdf`, sellerInvoiceIssuedAt: new Date() } });
  const emailAttemptedAt = new Date();
  await db.sellerClosureToken.create({ data: { businessId, userId, tokenHash: hashAuthToken(rawToken), expiresAt: new Date(Date.now() + 10 * 60_000), emailAttemptedAt, emailSentAt: emailAttemptedAt } });
});

test.afterAll(async () => {
  // Fixtures intentionally remain in the one-off disposable database. SellerBusiness
  // audit events are append-only, so deleting the fixture rows would violate the
  // production integrity contract; the entire database is discarded after this run.
  await db.$disconnect();
});

test("production-build closure confirmation, buyer access, reactivation and stock review preserve lifecycle state", async ({ page }) => {
  test.setTimeout(120_000);
  await addSession(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const dashboardResponse = await page.goto("/en/dashboard");
  expect(dashboardResponse?.ok()).toBeTruthy();
  await expect(page.locator(".dashboardSkeleton")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // A closure request only sends a confirmation email. With mail deliberately
  // disabled in this isolated server, delivery fails closed and the seller stays active.
  const requestResult = await page.evaluate(async () => {
    const response = await fetch("/api/seller/closure/request", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect([200, 503]).toContain(requestResult.status);
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe("SELLER");
  expect((await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId } })).sellerClosedAt).toBeNull();
  expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).status).toBe("PUBLISHED");

  await page.goto(`/en/seller/closure/confirm#token=${rawToken}`);
  await page.getByRole("button", { name: sellerLifecycleCopy("en").closureConfirm }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Welcome back, Lifecycle/i })).toBeVisible();
  const closed = await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId } });
  expect(closed.sellerClosedAt).toBeTruthy();
  expect(closed.reactivationStockReviewRequired).toBe(true);
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe("CUSTOMER");
  expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).status).toBe("DRAFT");
  const historicalOrder = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(historicalOrder.sellerInvoiceReference).toBe(`INV-PHASE3-${suffix}`);
  expect(historicalOrder.sellerInvoiceUrl).toBe(`https://documents.invalid/phase3/${suffix}.pdf`);
  const closedSubscription = await db.sellerSubscription.findUniqueOrThrow({ where: { storeId } });
  expect(closedSubscription.plan).toBe("pro");
  expect(closedSubscription.status).toBe("ACTIVE");
  expect(closedSubscription.currentPeriodEnd).toEqual(periodEnd);
  expect(closedSubscription.cancelAtPeriodEnd).toBe(true);
  await page.goto("/en/account/orders");
  await expect(page.locator("strong:visible").filter({ hasText: `#${orderId}` }).first()).toBeVisible();
  await page.goto(`/en/account/orders/${orderId}`);
  await expect(page.locator("dd:visible").filter({ hasText: `INV-PHASE3-${suffix}` }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open seller invoice" })).toHaveAttribute("href", `https://documents.invalid/phase3/${suffix}.pdf`);
  const hiddenProductResponse = await page.goto(`/en/product/${productId}/lifecycle-test-product`);
  expect(hiddenProductResponse?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("Lifecycle test product", { exact: true })).toHaveCount(0);

  await page.goto("/en/dashboard");
  const checkoutAttempt = await page.evaluate(async (id) => {
    const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), items: [{ productId: id, quantity: 1 }], buyerCurrency: "EUR" }) });
    return { status: response.status, body: await response.json() };
  }, productId);
  expect(checkoutAttempt.status).toBeGreaterThanOrEqual(400);
  expect(checkoutAttempt.body).not.toHaveProperty("url");

  const reactivation = await page.evaluate(async () => {
    const response = await fetch("/api/seller/reactivation", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(reactivation.status).toBe(200);
  expect(reactivation.body.stockReviewRequired).toBe(true);
  expect(reactivation.body.cancellationRemainsScheduled).toBe(true);
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe("SELLER");
  expect((await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId } })).firstPaidTrialGrantedAt).toEqual(trialGrantedAt);
  expect((await db.sellerSubscription.findUniqueOrThrow({ where: { storeId } })).trialEnd).toEqual(trialEnd);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/seller/reactivate");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading").first()).toBeVisible();
  const stock = page.locator('input[type="number"]').first();
  await expect(stock).toBeVisible();
  await stock.fill("7");
  await page.getByRole("button", { name: sellerLifecycleCopy("ar").stockConfirm }).click();
  await expect(page).toHaveURL(/dashboard/);
  const finalBusiness = await db.sellerBusiness.findUniqueOrThrow({ where: { id: businessId } });
  const finalProduct = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const finalSubscription = await db.sellerSubscription.findUniqueOrThrow({ where: { storeId } });
  expect(finalBusiness.reactivationStockReviewRequired).toBe(false);
  expect(finalProduct.stock).toBe(7);
  expect(finalProduct.status).toBe("DRAFT");
  expect(finalSubscription.cancelAtPeriodEnd).toBe(true);
  expect(finalSubscription.trialEnd).toEqual(trialEnd);
  expect(finalBusiness.firstPaidTrialGrantedAt).toEqual(trialGrantedAt);
  await page.goto("/en/seller/subscription");
  await expect(page.getByRole("button", { name: sellerLifecycleCopy("en").restoreRenewal })).toBeVisible();
  await expect(page.getByText(/26\.99/)).toBeVisible();
  await expect(page.getByText(sellerLifecycleCopy("en").trialOffer)).toHaveCount(0);
  await page.getByRole("button", { name: sellerLifecycleCopy("en").restoreRenewal }).click();
  const renewalPrompt = page.getByRole("group");
  await expect(renewalPrompt).toContainText(new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(periodEnd));
  await expect(renewalPrompt).toContainText("€26.99 Monthly");
  expect((await db.sellerSubscription.findUniqueOrThrow({ where: { storeId } })).cancelAtPeriodEnd).toBe(true);
  await renewalPrompt.getByRole("button", { name: sellerLifecycleCopy("en").keepCancellation }).click();
  await expect(renewalPrompt).toHaveCount(0);
  expect((await db.sellerSubscription.findUniqueOrThrow({ where: { storeId } })).cancelAtPeriodEnd).toBe(true);
});
