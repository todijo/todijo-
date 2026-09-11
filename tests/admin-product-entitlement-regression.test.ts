import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { canonicalActiveSellerPlanId } from "../lib/seller-plans";
import { requireProductCreationAccess, sellerProductQuota, SellerSubscriptionError } from "../lib/seller-subscription";
import { locales } from "../i18n/config";
import { sellerEntitlementSubscriptionMessages } from "../i18n/seller-entitlement-subscription";

const newProductPage = fs.readFileSync("app/seller/products/new/page.tsx", "utf8");
const newProductForm = fs.readFileSync("app/seller/products/new/NewProductForm.tsx", "utf8");
const productRoute = fs.readFileSync("app/api/products/route.ts", "utf8");
const subscriptionPlans = fs.readFileSync("app/seller/subscription/SubscriptionPlans.tsx", "utf8");

test("an admin bypasses a nominal 50-product quota without pretending to have a paid plan", () => {
  assert.deepEqual(sellerProductQuota({ role: "ADMIN", plan: "basic", productCount: 264 }), { productLimit: null, blocked: false });
  assert.match(newProductPage, /owner: \{ select: \{ firstName: true, lastName: true, role: true \} \}/);
  assert.match(newProductPage, /adminUnlimitedUsage/);
});

test("admin entitlement and subscription copy covers every supported locale without English fallback", () => {
  assert.deepEqual(Object.keys(sellerEntitlementSubscriptionMessages).sort(), [...locales].sort());
  for (const locale of locales) {
    const copy=sellerEntitlementSubscriptionMessages[locale];
    for (const value of [copy.dashboard,copy.title,copy.intro,copy.currentStatus,copy.cancels,copy.adminAccess,copy.perMonth,copy.unlimited,copy.sellerDashboard,copy.ordersRevenue,copy.opening,copy.active,copy.anotherActive,copy.subscribe,copy.unavailable,copy.checkoutError,copy.adminUnlimitedUsage(264),copy.upTo(50)]) assert.ok(value.trim());
  }
  for (const locale of ["ar","ku","tr","de","es","it","nl"] as const) {
    assert.notEqual(sellerEntitlementSubscriptionMessages[locale].title, sellerEntitlementSubscriptionMessages.en.title);
    assert.notEqual(sellerEntitlementSubscriptionMessages[locale].adminAccess, sellerEntitlementSubscriptionMessages.en.adminAccess);
  }
});

test("ordinary seller product limits remain enforced", () => {
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 49 }), { productLimit: 50, blocked: false });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 50 }), { productLimit: 50, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 264 }), { productLimit: 50, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "pro", productCount: 264 }), { productLimit: null, blocked: false });
});

function entitlementDb(role: "ADMIN" | "SELLER", productCount: number) {
  return {
    user: { findUnique: async () => ({ sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null }) },
    store: { findUnique: async () => ({ id: "store-1", currency: "EUR", status: "ACTIVE", sellerType: "INDIVIDUAL", vatStatus: "NOT_APPLICABLE", owner: { role }, subscription: { status: "ACTIVE", currentPeriodEnd: null, plan: "basic" }, accessGrants: [], _count: { products: productCount } }) },
  };
}

test("the creation gate allows the database admin and rejects the database seller at the same count", async () => {
  await assert.doesNotReject(() => requireProductCreationAccess(entitlementDb("ADMIN", 264) as never, "user-1"));
  await assert.rejects(() => requireProductCreationAccess(entitlementDb("SELLER", 264) as never, "user-1"), (error: unknown) => error instanceof SellerSubscriptionError && error.code === "SELLER_PRODUCT_LIMIT_REACHED");
});

test("draft and published creation share the database-authoritative quota gate", () => {
  assert.match(productRoute, /requireProductCreationAccess\(prisma, session\.userId\)/);
  assert.ok(productRoute.indexOf("requireProductCreationAccess") < productRoute.indexOf("await request.json()"), "payload cannot request or spoof the admin role");
  assert.match(productRoute, /body\.status === "DRAFT" \? "DRAFT" : "PUBLISHED"/);
});

test("only the canonical active paid plan is active", () => {
  assert.equal(canonicalActiveSellerPlanId({ status: "ACTIVE", plan: "basic" }), "basic");
  assert.equal(canonicalActiveSellerPlanId({ status: "TRIALING", plan: "pro" }), "pro");
  assert.equal(canonicalActiveSellerPlanId({ status: "PAST_DUE", plan: "basic" }), null);
  assert.equal(canonicalActiveSellerPlanId({ status: "ACTIVE", plan: "invented-admin-plan" }), null);
  assert.match(subscriptionPlans, /const isActive=activePlanId===plan\.id/);
  assert.doesNotMatch(subscriptionPlans, /active \? "Subscription active"/);
});

test("valid whole and decimal prices use native positive decimal validation and clear stale errors", () => {
  assert.match(newProductForm, /name="price" type="number" min="0\.01" max="1000000" step="0\.01" required/);
  for (const validPrice of ["12", "12.00", "12.34"]) {
    const price = Number(validPrice);
    assert.equal(Number.isFinite(price) && price > 0 && price <= 1_000_000, true);
  }
  for (const invalidPrice of ["", "invalid", "0", "-12"]) {
    const price = Number(invalidPrice);
    assert.equal(Boolean(invalidPrice) && Number.isFinite(price) && price > 0 && price <= 1_000_000, false);
  }
  assert.match(newProductForm, /stepValidation\?\.step===step&&!panel\?\.querySelector\(":invalid"\)\)setStepValidation\(null\)/);
  assert.match(newProductForm, /<ProductVariantEditor[^>]+basePrice=\{basePrice\}/);
});
