import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const db = new PrismaClient();
const secret = "e2e-only-placeholder-secret-at-least-32-characters";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const buyerId = `phase6-buyer-${suffix}`;
const sellerA = `phase6-seller-a-${suffix}`;
const sellerB = `phase6-seller-b-${suffix}`;
const businessA = `phase6-business-a-${suffix}`;
const businessB = `phase6-business-b-${suffix}`;
const storeA = `phase6-store-a-${suffix}`;
const storeB = `phase6-store-b-${suffix}`;
const productA = `phase6-product-a-${suffix}`;
const productB = `phase6-product-b-${suffix}`;
const orderId = `phase6-order-${suffix}`;
const groupA = `phase6-group-a-${suffix}`;
const groupB = `phase6-group-b-${suffix}`;
const itemA = `phase6-item-a-${suffix}`;
const itemB = `phase6-item-b-${suffix}`;

async function setSession(page: import("@playwright/test").Page, userId: string, role: "SELLER" | "CUSTOMER") {
  await page.context().clearCookies();
  const value = await new SignJWT({ userId, role, authVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  await page.context().addCookies([{ name: "todijo_session", value, url: "http://localhost:3100", httpOnly: true, sameSite: "Lax" }]);
}

test.beforeAll(async () => {
  await db.user.createMany({ data: [
    { id: buyerId, firstName: "Phase6", lastName: "Buyer", email: `${suffix}@buyer.phase6.invalid`, role: "CUSTOMER", emailVerified: true, authVersion: 0 },
    { id: sellerA, firstName: "Seller", lastName: "Alpha", email: `${suffix}-a@seller.phase6.invalid`, role: "SELLER", emailVerified: true, authVersion: 0 },
    { id: sellerB, firstName: "Seller", lastName: "Beta", email: `${suffix}-b@seller.phase6.invalid`, role: "SELLER", emailVerified: true, authVersion: 0 },
  ] });
  await db.sellerBusiness.createMany({ data: [{ id: businessA, ownerId: sellerA, maxStores: 3 }, { id: businessB, ownerId: sellerB, maxStores: 1 }] });
  await db.store.createMany({ data: [
    { id: storeA, name: `Shipment Store A ${suffix}`, slug: `phase6-a-${suffix}`, country: "FR", city: "Paris", contactEmail: `${suffix}-a@seller.phase6.invalid`, ownerId: sellerA, businessId: businessA, status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", onboardingStatus: "VERIFIED", onboardingStep: 4 },
    { id: storeB, name: `Shipment Store B ${suffix}`, slug: `phase6-b-${suffix}`, country: "FR", city: "Lyon", contactEmail: `${suffix}-b@seller.phase6.invalid`, ownerId: sellerB, businessId: businessB, status: "ACTIVE", sellerType: "PRIVATE", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", onboardingStatus: "VERIFIED", onboardingStep: 4 },
  ] });
  await db.sellerBusiness.update({ where: { id: businessA }, data: { billingStoreId: storeA } });
  await db.sellerBusiness.update({ where: { id: businessB }, data: { billingStoreId: storeB } });
  await db.user.update({ where: { id: sellerA }, data: { primaryStoreId: storeA } });
  await db.user.update({ where: { id: sellerB }, data: { primaryStoreId: storeB } });
  await db.sellerSubscription.createMany({ data: [
    { id: `phase6-sub-a-${suffix}`, storeId: storeA, plan: "pro", billingInterval: "monthly", stripePriceId: "price_phase6_test", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 86_400_000), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    { id: `phase6-sub-b-${suffix}`, storeId: storeB, plan: "plus", billingInterval: "monthly", stripePriceId: "price_phase6_test", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 86_400_000), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
  ] });
  await db.product.createMany({ data: [
    { id: productA, storeId: storeA, name: "Alpha shipment item", slug: `phase6-item-a-${suffix}`, description: "Fixture", price: 10, category: "test", condition: "NEUF", images: [], status: "PUBLISHED", stock: 7, complianceDeclaredAt: new Date() },
    { id: productB, storeId: storeB, name: "Private Beta shipment item", slug: `phase6-item-b-${suffix}`, description: "Fixture", price: 20, category: "test", condition: "NEUF", images: [], status: "PUBLISHED", stock: 4, complianceDeclaredAt: new Date() },
  ] });
  await db.order.create({ data: { id: orderId, buyerId, status: "PAID", currency: "EUR", total: 40, subtotal: 40, checkoutRequestId: `phase6-checkout-${suffix}`, paidAt: new Date(), stripePaymentIntentId: `pi_phase6_${suffix}`, buyerLocale: "en", buyerNameSnapshot: "Phase6 Buyer", buyerEmailSnapshot: `${suffix}@buyer.phase6.invalid`, fulfillmentStatus: "PROCESSING" } });
  await db.orderGroup.createMany({ data: [
    { id: groupA, orderId, groupKey: `store:${storeA}`, kind: "MARKETPLACE", storeId: storeA, storeIdSnapshot: storeA, storeNameSnapshot: `Shipment Store A ${suffix}`, maturitySnapshot: "NEW", maturityEvidence: { kind: "e2e" }, itemSubtotalMinor: 2000, shippingAmountMinor: 0, platformFeeAmountMinor: 0, sellerNetAmountMinor: 2000 },
    { id: groupB, orderId, groupKey: `store:${storeB}`, kind: "MARKETPLACE", storeId: storeB, storeIdSnapshot: storeB, storeNameSnapshot: `Shipment Store B ${suffix}`, maturitySnapshot: "NEW", maturityEvidence: { kind: "e2e" }, itemSubtotalMinor: 2000, shippingAmountMinor: 0, platformFeeAmountMinor: 0, sellerNetAmountMinor: 2000 },
  ] });
  await db.orderItem.createMany({ data: [
    { id: itemA, orderId, orderGroupId: groupA, productId: productA, quantity: 2, unitPrice: 10, lineKey: `phase6-line-a-${suffix}`, productNameSnapshot: "Alpha shipment item", currency: "EUR", lineTotal: 20 },
    { id: itemB, orderId, orderGroupId: groupB, productId: productB, quantity: 1, unitPrice: 20, lineKey: `phase6-line-b-${suffix}`, productNameSnapshot: "Private Beta shipment item", currency: "EUR", lineTotal: 20 },
  ] });
});

test.afterAll(async () => { await db.$disconnect(); });

test("production-build seller reports one store-scoped partial shipment; buyer sees only that shipment's items and partial status", async ({ page }) => {
  test.setTimeout(120_000);
  await setSession(page, sellerA, "SELLER");
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto(`/en/seller/orders?store=${storeA}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Record a shipment" })).toBeVisible();
  const shipmentForm = page.getByRole("region", { name: "Record a shipment" });
  await expect(shipmentForm.getByText("Alpha shipment item", { exact: true })).toBeVisible();
  await expect(page.getByText("Private Beta shipment item", { exact: true })).toHaveCount(0);
  const quantities = page.locator(".sellerShipmentItem input[type=number]");
  await expect(quantities).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sellerShipmentItems")).toBeVisible();
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(mobileOverflow).toBe(false);
  await page.setViewportSize({ width: 320, height: 568 });
  const narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(narrowOverflow).toBe(false);
  await page.setViewportSize({ width: 1440, height: 900 });
  const wrongStoreResponse = await page.evaluate(async ({ orderId, storeId, itemId }) => {
    const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}/shipments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, idempotencyKey: `wrong-store-${Date.now()}`, items: [{ orderItemId: itemId, quantity: 1 }] }) });
    return response.status;
  }, { orderId, storeId: storeB, itemId: itemB });
  expect(wrongStoreResponse).toBe(404);
  const overshipResponse = await page.evaluate(async ({ orderId, storeId, itemId, key }) => {
    const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}/shipments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, idempotencyKey: key, items: [{ orderItemId: itemId, quantity: 3 }] }) });
    return response.status;
  }, { orderId, storeId: storeA, itemId: itemA, key: `overship-${suffix}` });
  expect(overshipResponse).toBe(409);
  let firstRequestBody: Record<string, unknown> | null = null;
  page.on("request", (request) => { if (request.url().includes(`/api/seller/orders/${orderId}/shipments`)) firstRequestBody = request.postDataJSON() as Record<string, unknown>; });
  await quantities.fill("1");
  await page.getByRole("textbox", { name: "Carrier (optional)" }).fill("UPS");
  await page.getByRole("textbox", { name: "Tracking number (optional)" }).fill(`PHASE6-${suffix}`);
  const shipmentResponse = page.waitForResponse((candidate) => candidate.url().includes(`/api/seller/orders/${orderId}/shipments`) && candidate.request().method() === "POST");
  await page.getByRole("button", { name: "Save shipment" }).click();
  const shipmentResponseValue = await shipmentResponse;
  const shipmentResponseBody = await shipmentResponseValue.json();
  expect(shipmentResponseValue.status(), JSON.stringify(shipmentResponseBody)).toBe(200);
  await expect(page.getByText("Previously shipped: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Remaining to ship: 1", { exact: true })).toBeVisible();

  const productAAfterSellerAction = await db.product.findUniqueOrThrow({ where: { id: productA }, select: { stock: true } });
  const shipment = await db.shipment.findFirstOrThrow({ where: { orderId, storeId: storeA }, include: { items: true, emailDelivery: true } });
  expect(productAAfterSellerAction.stock).toBe(7);
  expect(shipment.items).toEqual([expect.objectContaining({ orderItemId: itemA, quantity: 1 })]);
  expect(shipment.status).toBe("SELLER_REPORTED");
  expect(shipment.emailDelivery?.kind).toBe("SHIPMENT_RECORDED");
  expect(shipment.emailDelivery?.items).toEqual([{ name: "Alpha shipment item", quantity: 1 }]);
  expect(JSON.stringify(shipment.emailDelivery?.items)).not.toContain("Private Beta");
  if (!firstRequestBody) throw new Error("Shipment submission was not captured.");
  const duplicate = await page.evaluate(async ({ orderId, body }) => {
    const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}/shipments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { orderId, body: firstRequestBody });
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.idempotent).toBe(true);
  expect(await db.shipment.count({ where: { orderGroupId: groupA } })).toBe(1);
  await setSession(page, buyerId, "CUSTOMER");
  await page.goto(`/en/account/orders/${orderId}`);
  await expect(page.getByText("Partially shipped", { exact: true })).toBeVisible();
  const firstShipmentCard = page.locator(".shipmentTrackingCard").filter({ hasText: `PHASE6-${suffix}` });
  await expect(firstShipmentCard).toContainText("Alpha shipment item × 1");
  await expect(firstShipmentCard).not.toContainText("Private Beta shipment item");

  await setSession(page, sellerA, "SELLER");
  await page.goto(`/en/seller/orders?store=${storeA}`);
  const concurrent = await page.evaluate(async ({ orderId, storeId, itemId, key, tracking }) => Promise.all([1, 2].map(async () => {
    const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}/shipments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, idempotencyKey: key, items: [{ orderItemId: itemId, quantity: 1 }], carrier: "UPS", trackingNumber: tracking }) });
    return { status: response.status, body: await response.json() };
  })), { orderId, storeId: storeA, itemId: itemA, key: `concurrent-${suffix}`, tracking: `PHASE6-SECOND-${suffix}` });
  expect(concurrent.map((result) => result.status)).toEqual([200, 200]);
  expect(concurrent.map((result) => result.body.idempotent).sort()).toEqual([false, true]);
  expect(await db.shipment.count({ where: { orderGroupId: groupA } })).toBe(2);
  const persistedOrder = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, fulfillmentStatus: true } });
  expect(persistedOrder.status).toBe("PROCESSING");
  expect(persistedOrder.fulfillmentStatus).toBe("PARTIALLY_SHIPPED");

  await setSession(page, sellerB, "SELLER");
  await page.goto(`/ar/seller/orders?store=${storeB}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("Private Beta shipment item", { exact: true })).toBeVisible();
  await expect(page.getByText("Alpha shipment item", { exact: true })).toHaveCount(0);
  const betaQuantity = page.locator(".sellerShipmentItem input[type=number]");
  await betaQuantity.fill("1");
  await page.getByRole("button", { name: "حفظ الشحنة" }).click();
  const completeOrder = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, fulfillmentStatus: true } });
  expect(completeOrder).toEqual({ status: "SHIPPED", fulfillmentStatus: "SHIPPED" });
  const allShipmentDeliveries = await db.buyerOrderEmailDelivery.findMany({ where: { orderId, shipmentId: { not: null } }, orderBy: { createdAt: "asc" }, select: { kind: true, storeName: true, items: true } });
  expect(allShipmentDeliveries).toHaveLength(3);
  expect(allShipmentDeliveries.map((delivery) => delivery.items)).toEqual([[{ name: "Alpha shipment item", quantity: 1 }], [{ name: "Alpha shipment item", quantity: 1 }], [{ name: "Private Beta shipment item", quantity: 1 }]]);
  expect(allShipmentDeliveries.every((delivery) => delivery.kind === "SHIPMENT_RECORDED")).toBe(true);
  await setSession(page, buyerId, "CUSTOMER");
  const buyerResponse = await page.goto(`/en/account/orders/${orderId}`);
  expect(buyerResponse?.ok()).toBeTruthy();
  await expect(page.getByText("Shipped", { exact: true })).toBeVisible();
  const alphaShipment = page.locator(".shipmentTrackingCard").filter({ hasText: `PHASE6-${suffix}` });
  await expect(alphaShipment).toContainText("Alpha shipment item × 1");
  await expect(alphaShipment).not.toContainText("Private Beta shipment item");
  const betaShipment = page.locator(".shipmentTrackingCard").filter({ hasText: `PHASE6-BETA-${suffix}` });
  await expect(betaShipment).toContainText("Private Beta shipment item × 1");
  await expect(betaShipment).not.toContainText("Alpha shipment item");
});
