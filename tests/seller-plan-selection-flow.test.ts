import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerPlanSelectionMessages } from "../i18n/seller-plan-selection";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "../lib/seller-registration-intent";
import { configuredSellerPlan } from "../lib/seller-plans";

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
  for (const plan of ["basic", "plus", "pro"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      assert.deepEqual(explicitSellerRegistrationIntent(plan, interval), { plan, interval });
    }
  }
  assert.equal(explicitSellerRegistrationIntent("enterprise", "monthly"), null);
  assert.equal(explicitSellerRegistrationIntent("pro", "weekly"), null);
  assert.equal(explicitSellerRegistrationIntent("pro", undefined), null);
});

test("seller entry points cannot silently bypass explicit plan selection", () => {
  const sell = source("app/sell/page.tsx");
  const dashboard = source("app/dashboard/page.tsx");
  const footer = source("components/MarketplaceFooter.tsx");
  const sellerLayout = source("components/SellerDashboardLayout.tsx");
  const register = source("app/register/page.tsx");
  const createStore = source("app/seller/create-store/page.tsx");
  assert.match(sell, /className="primary" href="#plans"/);
  assert.doesNotMatch(sell, /register\?role=seller`/);
  assert.equal((dashboard.match(/sell#plans/g) ?? []).length, 2);
  assert.equal((footer.match(/sell#plans/g) ?? []).length, 1);
  assert.match(sellerLayout, /storeSlug \?[^:]+: `\/\$\{locale\}\/sell#plans`/);
  assert.match(register, /query\.role === "seller" && !intent/);
  assert.match(createStore, /if \(!intent\) redirect\(`\/\$\{locale\}\/sell#plans`\)/);
});

test("canonical seller intent survives password and social auth, store creation, and subscription", () => {
  const form = source("app/register/RegisterForm.tsx");
  const social = source("components/SocialLoginButtons.tsx");
  const route = source("app/api/auth/register/route.ts");
  const createStore = source("app/seller/create-store/page.tsx");
  const onboardingForm = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  const subscription = source("app/seller/subscription/page.tsx");
  assert.match(form, /sellerOnboardingPath\(locale, false, sellerIntent\)/);
  assert.match(form, /<SocialLoginButtons next=/);
  assert.match(social, /explicitNext\?\?params\?\.get\("next"\)/);
  assert.match(route, /code: "ACCOUNT_EXISTS"/);
  assert.match(route, /explicitSellerRegistrationIntent\(body\?\.plan, body\?\.interval\)/);
  assert.match(createStore, /sellerOnboardingDestination/);
  assert.match(onboardingForm, /sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.match(subscription, /initialPlanId=\{sellerIntent\?\.plan \?\? null\}/);
  assert.equal(sellerOnboardingPath("fr", false, { plan: "basic", interval: "annual" }), "/fr/seller/onboarding?plan=basic&interval=annual");
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

test("Stripe checkout keeps canonical six-price authority", () => {
  const previous = { ...process.env };
  process.env.STRIPE_SELLER_BASIC_MONTHLY_PRICE_ID = "price_basicmonthly";
  process.env.STRIPE_SELLER_BASIC_ANNUAL_PRICE_ID = "price_basicannual";
  process.env.STRIPE_SELLER_PLUS_MONTHLY_PRICE_ID = "price_plusmonthly";
  process.env.STRIPE_SELLER_PLUS_ANNUAL_PRICE_ID = "price_plusannual";
  process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID = "price_promonthly";
  process.env.STRIPE_SELLER_PRO_ANNUAL_PRICE_ID = "price_proannual";
  try {
    assert.equal(configuredSellerPlan("basic", "monthly")?.priceId, "price_basicmonthly");
    assert.equal(configuredSellerPlan("basic", "annual")?.priceId, "price_basicannual");
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
