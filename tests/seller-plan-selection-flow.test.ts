import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerPlanSelectionMessages } from "../i18n/seller-plan-selection";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "../lib/seller-registration-intent";
import { configuredSellerPlan } from "../lib/seller-plans";
import { sellerRegistrationRequirements } from "../lib/seller-registration-requirements";

const source = (path: string) => readFileSync(path, "utf8");

test("public seller plans make monthly and annual pricing explicit", () => {
  const chooser = source("app/sell/SellerPlanChooser.tsx");
  const page = source("app/sell/page.tsx");
  assert.match(chooser, /useState<SellerBillingInterval>\("monthly"\)/);
  assert.match(chooser, /plan\.monthlyAmountMinor : plan\.annualAmountMinor/);
  assert.match(chooser, /copy\.save20/);
  assert.match(page, /sellerPlans\(\)\.map/);
  assert.doesNotMatch(page, /699|6710|1499|14390|2699|25910/);
});

test("every canonical plan CTA preserves its plan and selected interval", () => {
  const chooser = source("app/sell/SellerPlanChooser.tsx");
  assert.match(chooser, /register\?role=seller&plan=\$\{plan\.id\}&interval=\$\{interval\}/);
  for (const plan of ["plus", "pro"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      assert.deepEqual(explicitSellerRegistrationIntent(plan, interval), { plan, interval });
    }
  }
  assert.equal(explicitSellerRegistrationIntent("enterprise", "monthly"), null);
  assert.equal(explicitSellerRegistrationIntent("pro", "weekly"), null);
  assert.equal(explicitSellerRegistrationIntent("pro", undefined), null);
});

test("direct seller entry starts FREE without forced paid selection", () => {
  assert.equal(explicitSellerRegistrationIntent("free", "monthly"), null);
  assert.equal(sellerOnboardingPath("fr", false, null), "/fr/dashboard");
  assert.doesNotMatch(source("app/register/page.tsx"), /query\.role === "seller" && !intent/);
  assert.doesNotMatch(source("app/seller/create-store/page.tsx"), /if \(!intent\) redirect/);
  assert.match(source("app/dashboard/page.tsx"), /FreeSellerStartCard/);
  assert.match(source("app/seller/onboarding/SellerAddressOnboardingForm.tsx"), /sellerIntent \? sellerOnboardingPath\(locale, true, sellerIntent\) : `\/\$\{locale\}\/seller\/subscription`/);
  assert.match(source("app/seller/subscription/page.tsx"), /<SubscriptionPlans/);
});

test("FREE, PLUS and PRO share the same seller identity requirements", () => {
  assert.deepEqual(sellerRegistrationRequirements("FR", "PROFESSIONAL"), { registrationRequired: true, registrationLabel: "siret", vatSupported: true, format: "FR_SIRET" });
  assert.deepEqual(sellerRegistrationRequirements("FR", "PRIVATE"), { registrationRequired: false, registrationLabel: "siret", vatSupported: true, format: "FR_SIRET" });
  const onboardingApi = source("app/api/seller/onboarding/route.ts");
  assert.match(onboardingApi, /sellerRegistrationRequirements\(country, sellerType\)/);
  assert.doesNotMatch(onboardingApi, /sellerRegistrationRequirements\([^)]*plan/);
});

test("canonical seller intent survives password and social auth, store creation, and subscription", () => {
  const form = source("app/register/RegisterForm.tsx");
  const social = source("components/SocialLoginButtons.tsx");
  const route = source("app/api/auth/register/route.ts");
  const createStore = source("app/seller/create-store/page.tsx");
  const onboardingForm = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  const subscription = source("app/seller/subscription/page.tsx");
  assert.match(form, /sellerIntent \? sellerOnboardingPath\(safeLocale, false, sellerIntent\)/);
  assert.match(form, /<SocialLoginButtons next=/);
  assert.match(social, /explicitNext\?\?params\?\.get\("next"\)/);
  assert.match(route, /code: "ACCOUNT_EXISTS"/);
  assert.match(route, /const explicitSellerIntent = input\.sellerIntent/);
  assert.match(route, /safeLoginDestination\(body\.next, locale\)/);
  assert.match(createStore, /sellerOnboardingDestination/);
  assert.match(onboardingForm, /sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.match(subscription, /initialPlanId=\{sellerIntent\?\.plan \?\? null\}/);
  assert.equal(sellerOnboardingPath("fr", false, { plan: "plus", interval: "annual" }), "/fr/seller/onboarding?plan=plus&interval=annual");
});

test("seller subscription serializes only resolved strings into its Client Component", () => {
  const page = source("app/seller/subscription/page.tsx");
  const plans = source("app/seller/subscription/SubscriptionPlans.tsx");
  assert.match(page, /productLimitLabel:plan\.productLimit\?copy\.upTo\(plan\.productLimit\):copy\.unlimited/);
  assert.match(page, /copy=\{clientCopy\}/);
  assert.doesNotMatch(plans, /upTo:\s*\(limit:/);
  assert.match(plans, /<p>\{plan\.productLimitLabel\}<\/p>/);
});

test("legacy onboarding converges new sellers while preserving existing resumable records", () => {
  const onboarding = source("app/seller/onboarding/page.tsx");
  const legacy = source("app/seller/create-store/page.tsx");
  assert.match(onboarding, /explicitSellerRegistrationIntent\(query\.plan, query\.interval\)/);
  assert.match(onboarding, /sellerOnboardingDestination/);
  assert.match(onboarding, /<SellerOnboardingForm/);
  assert.match(legacy, /sellerOnboardingDestination/);
  assert.doesNotMatch(legacy, /CreateStoreForm|<form/);
});

test("seller selection copy exists for every supported locale including RTL", () => {
  for (const locale of locales) {
    const copy = sellerPlanSelectionMessages[locale];
    assert.ok(copy.monthly && copy.annual && copy.save20 && copy.perMonth && copy.perYear);
    assert.ok(copy.startWith("Pro").includes("Pro"));
  }
});

test("Stripe checkout keeps four paid-price authority and never bills FREE", () => {
  const previous = { ...process.env };
  process.env.STRIPE_SELLER_BASIC_MONTHLY_PRICE_ID = "price_basicmonthly";
  process.env.STRIPE_SELLER_BASIC_ANNUAL_PRICE_ID = "price_basicannual";
  process.env.STRIPE_SELLER_PLUS_MONTHLY_PRICE_ID = "price_plusmonthly";
  process.env.STRIPE_SELLER_PLUS_ANNUAL_PRICE_ID = "price_plusannual";
  process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = "price_promonthly";
  process.env.STRIPE_SELLER_PRO_ANNUAL_PRICE_ID = "price_proannual";
  try {
    assert.equal(configuredSellerPlan("free", "monthly"), null);
    assert.equal(configuredSellerPlan("free", "annual"), null);
    assert.equal(configuredSellerPlan("plus", "monthly")?.priceId, "price_plusmonthly");
    assert.equal(configuredSellerPlan("plus", "annual")?.priceId, "price_plusannual");
    assert.equal(configuredSellerPlan("pro", "monthly")?.priceId, "price_promonthly");
    assert.equal(configuredSellerPlan("pro", "annual")?.priceId, "price_proannual");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
  assert.match(source("app/api/seller/subscription/checkout/route.ts"), /configuredSellerPlan\(body\.planId, body\.interval\)/);
});

test("buyer and Admin-grant authority remain outside plan selection", () => {
  const route = source("app/api/auth/register/route.ts");
  const grant = source("lib/seller-subscription.ts");
  assert.match(route, /input\.role === "CUSTOMER"/);
  assert.doesNotMatch(route, /accessGrant|SellerAccessGrant/);
  assert.match(grant, /ADMIN_GRANT/);
  assert.doesNotMatch(source("app/sell/SellerPlanChooser.tsx"), /entitlement|subscription\.create|checkout/);
});
