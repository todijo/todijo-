import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeLoginDestination } from "../lib/auth-redirects";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "../lib/seller-registration-intent";
import { configuredSellerPlan } from "../lib/seller-plans";

const source=(path:string)=>readFileSync(path,"utf8");

test("PLUS PLUS and PRO monthly or annual intent remains canonical through auth and onboarding",()=>{
  for(const plan of ["plus","plus","pro"] as const)for(const interval of ["monthly","annual"] as const){
    const intent=explicitSellerRegistrationIntent(plan,interval);
    assert.deepEqual(intent,{plan,interval});
    assert.equal(sellerOnboardingPath("fr",false,intent),`/fr/seller/onboarding?plan=${plan}&interval=${interval}`);
  }
  assert.equal(explicitSellerRegistrationIntent("enterprise","monthly"),null);
  assert.equal(explicitSellerRegistrationIntent("pro","weekly"),null);
  assert.equal(safeLoginDestination("https://evil.test/steal","fr"),"/fr");
});

test("registration and verification preserve only the safe seller continuation",()=>{
  const register=source("app/api/auth/register/route.ts"),email=source("lib/email/send.ts"),verify=source("app/api/auth/verify-email/route.ts"),client=source("app/verify-email/VerifyEmailClient.tsx");
  assert.match(register,/sendVerificationEmail\([^\n]+next/);
  assert.match(email,/url\.searchParams\.set\("next",input\.next\)/);
  assert.match(verify,/nextValue\?safeLoginDestination\(nextValue,locale\):user\?\.role==="SELLER"\?sellerOnboardingDestination/);
  assert.match(client,/success&&next\?next/);
});

test("onboarding is branded and continues to subscription review instead of dashboard",()=>{
  const page=source("app/seller/onboarding/page.tsx"),form=source("app/seller/onboarding/SellerAddressOnboardingForm.tsx"),journey=source("i18n/seller-onboarding-journey.ts");
  assert.match(page,/sellerPlanEntitlement\(intent\.plan\)/);
  assert.match(form,/sellerJourneyProgress/);
  assert.match(form,/sellerSelectedPlan/);
  assert.match(form,/sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.doesNotMatch(form,/location\.assign\(`\/\$\{locale\}\/dashboard`\)/);
  assert.match(journey,/Bienvenue parmi les vendeurs Todijo/);
  assert.match(journey,/Welcome to Todijo sellers/);
});

test("subscription review uses canonical server plan amounts and checkout price mapping",()=>{
  const previous={...process.env};
  process.env.STRIPE_SELLER_PRO_MONTHLY_PRICE_ID="price_promonthly";
  process.env.STRIPE_SELLER_PRO_ANNUAL_PRICE_ID="price_proannual";
  try{
    assert.equal(configuredSellerPlan("pro","monthly")?.amountMinor,2699);
    assert.equal(configuredSellerPlan("pro","annual")?.amountMinor,25910);
  }finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous)}
  const api=source("app/api/seller/subscription/checkout/route.ts"),stripe=source("lib/stripe.ts");
  assert.match(source("app/seller/subscription/SubscriptionPlans.tsx"),/sellerSubscriptionReview/);
  assert.match(api,/configuredSellerPlan\(body\.planId, body\.interval\)/);
  assert.match(stripe,/metadata\[interval\]/);
  assert.match(stripe,/idempotencyKey: input\.idempotencyKey/);
});

test("authoritative post-payment state resumes Connect and avoids duplicate checkout",()=>{
  const page=source("app/seller/subscription/page.tsx"),activation=source("app/seller/subscription/ActivatingSubscription.tsx"),setup=source("app/seller/payment-setup/page.tsx"),api=source("app/api/seller/subscription/checkout/route.ts"),checkout=source("lib/seller-subscription-checkout.ts");
  assert.match(page,/connectReady\?`\/\$\{locale\}\/dashboard`:`\/\$\{locale\}\/seller\/payment-setup`/);
  assert.match(activation,/seller\/payment-setup/);
  assert.match(setup,/sellerBusinessCommercialEntitlement/);
  assert.match(setup,/if\(ready\)redirect\(`\/\$\{locale\}\/dashboard`\)/);
  assert.match(api,/already has an active subscription/);
  assert.match(api,/createOrReuseSellerSubscriptionCheckout/);
  assert.match(checkout,/sellerSubscription\.upsert/);
});
