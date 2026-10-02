import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sellerOnboardingDestination } from "../lib/seller-onboarding-flow";

const source = (path: string) => readFileSync(path, "utf8");
const annualPro = { plan: "pro", interval: "annual" } as const;

test("new sellers start at plans while explicit intent enters canonical onboarding unchanged", () => {
  assert.equal(sellerOnboardingDestination({ locale: "fr", intent: null, hasStore: false, hasDraft: false }), "/fr/sell#plans");
  assert.equal(sellerOnboardingDestination({ locale: "ku", intent: annualPro, hasStore: false, hasDraft: false }), "/ku/seller/onboarding?plan=pro&interval=annual");
});

test("drafts and incomplete stores resume the one canonical onboarding route", () => {
  assert.equal(sellerOnboardingDestination({ locale: "en", intent: null, hasStore: false, hasDraft: true }), "/en/seller/onboarding");
  assert.equal(sellerOnboardingDestination({ locale: "fr", intent: annualPro, hasStore: true, hasDraft: false, onboardingStatus: "IN_PROGRESS", onboardingStep: 2, entitlementSource: "NONE" }), "/fr/seller/onboarding?plan=pro&interval=annual");
  assert.equal(sellerOnboardingDestination({ locale: "ar", intent: null, hasStore: true, hasDraft: false, onboardingStatus: "NEEDS_INFORMATION", onboardingStep: 4, entitlementSource: "NONE" }), "/ar/seller/onboarding");
});

test("completed stores go to entitlement or dashboard state without changing intent", () => {
  assert.equal(sellerOnboardingDestination({ locale: "fr", intent: annualPro, hasStore: true, hasDraft: false, onboardingStatus: "PENDING_REVIEW", onboardingStep: 4, entitlementSource: "NONE" }), "/fr/seller/subscription?plan=pro&interval=annual");
  for (const source of ["STRIPE", "ADMIN_GRANTED", "ADMIN_EXEMPT"] as const) assert.equal(sellerOnboardingDestination({ locale: "fr", intent: annualPro, hasStore: true, hasDraft: false, onboardingStatus: "VERIFIED", onboardingStep: 4, entitlementSource: source }), "/fr/dashboard");
});

test("legacy create-store is redirect-only and cannot create a competing store", () => {
  const page = source("app/seller/create-store/page.tsx");
  assert.match(page, /sellerOnboardingDestination/);
  assert.doesNotMatch(page, /CreateStoreForm|<form|store\.create/);
  assert.match(source("app/api/store/route.ts"), /STORE_LIMIT_REACHED/);
  assert.match(source("app/api/store/route.ts"), /MULTI_STORE_PRO_REQUIRED/);
});

test("canonical onboarding preserves identity, Phase 4 address reuse, and plan continuity", () => {
  const page = source("app/seller/onboarding/page.tsx"), form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx"), route = source("app/api/seller/onboarding/route.ts");
  assert.match(page, /defaultBuyerAddress\(prisma, session\.userId\)/);
  assert.match(page, /sellerIntent=\{intent\}/);
  assert.match(form, /sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.match(route, /where:\{id:user\.id\},data:\{role:"SELLER"\}/);
  assert.match(route, /const store=user\.store\?await tx\.store\.update/);
  assert.doesNotMatch(route, /buyerShippingAddress\.(create|update|delete)|tx\.user\.create/);
});

test("Admin grants remain server-authoritative and never require Stripe checkout", () => {
  const createStore = source("app/seller/create-store/page.tsx"), subscription = source("app/seller/subscription/page.tsx");
  assert.match(createStore, /activeAccessSource\(store\)\.source/);
  assert.match(subscription, /accessSource==="ADMIN_GRANTED"/);
  assert.match(subscription, /hasActiveSubscription=\{hasActiveEntitlement\}/);
});

test("redirect construction is localized, same-origin, and has no client redirect input", () => {
  const helper = source("lib/seller-onboarding-flow.ts");
  assert.match(helper, /const root = `\/\$\{state\.locale\}`/);
  assert.doesNotMatch(helper, /next|returnTo|redirectTo|new URL/);
  assert.doesNotMatch(helper, /interval: "monthly"|plan: "basic"/);
});

test("existing activity restrictions and subscription authority stay unchanged", () => {
  const onboarding = source("app/api/seller/onboarding/route.ts"), checkout = source("app/api/seller/subscription/checkout/route.ts");
  assert.match(onboarding, /assertSellerActivity\(prisma,session\.userId\)/);
  assert.match(checkout, /assertSellerActivity/);
  assert.match(checkout, /createSellerSubscriptionCheckout/);
});
