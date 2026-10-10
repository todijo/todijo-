import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { sellerOnboardingCompletion } from "../lib/seller-onboarding-completion";

test("ordinary completed private and non-French professional sellers activate without general Admin approval", () => {
  assert.deepEqual(sellerOnboardingCompletion({ professional: false, country: "FR" }), { kind: "ACTIVATE", storeStatus: "ACTIVE", onboardingStatus: "VERIFIED" });
  assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "DE" }), { kind: "ACTIVATE", storeStatus: "ACTIVE", onboardingStatus: "VERIFIED" });
});

test("French professional sellers activate only after matching INSEE verification", () => {
  assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "FR", businessState: "VERIFIED", establishmentState: "VERIFIED" }), { kind: "ACTIVATE", storeStatus: "ACTIVE", onboardingStatus: "VERIFIED" });
  assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "FR", businessState: "PENDING", establishmentState: "PENDING" }), { kind: "VERIFICATION_REQUIRED" });
  assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "FR", businessState: "REJECTED", establishmentState: "REJECTED" }), { kind: "VERIFICATION_REQUIRED" });
});

test("Admin review is limited to the existing exceptional INSEE manual-review outcome", () => {
  for (const businessState of ["MANUAL_REVIEW", "VERIFIED"]) {
    assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "FR", businessState, establishmentState: "MANUAL_REVIEW" }), { kind: "ADMIN_REVIEW", storeStatus: "PENDING", onboardingStatus: "PENDING_REVIEW" });
  }
  assert.deepEqual(sellerOnboardingCompletion({ professional: true, country: "FR", businessState: "MANUAL_REVIEW", establishmentState: "VERIFIED" }), { kind: "VERIFICATION_REQUIRED" });
});

test("onboarding submission persists normal completion as active and only queues exceptional review", () => {
  const route = readFileSync(join(process.cwd(), "app/api/seller/onboarding/route.ts"), "utf8");
  assert.match(route, /sellerOnboardingCompletion\(/);
  assert.match(route, /status: completion\.storeStatus/);
  assert.match(route, /onboardingStatus: completion\.onboardingStatus/);
  assert.match(route, /completion\.kind === "ADMIN_REVIEW" && isSellerReviewSubmissionTransition/);
  assert.doesNotMatch(route, /onboardingStatus: "PENDING_REVIEW" as const[\s\S]{0,500}return \(await queueSellerReviewEmail/);
});

test("ordinary seller activation is not blocked by email verification while verification infrastructure remains", () => {
  const route = readFileSync(join(process.cwd(), "app/api/seller/onboarding/route.ts"), "utf8");
  assert.doesNotMatch(route, /emailVerified|EMAIL_VERIFICATION_REQUIRED/);
  assert.match(readFileSync(join(process.cwd(), "app/api/auth/verify-email/route.ts"), "utf8"), /consumeEmailVerificationToken/);
  assert.match(readFileSync(join(process.cwd(), "lib/auth-tokens.ts"), "utf8"), /emailVerified:\s*true/);
  assert.match(readFileSync(join(process.cwd(), "lib/auth-tokens.ts"), "utf8"), /consumeEmailChangeToken/);
});

test("completed onboarding continues to plan selection unless a canonical paid plan intent was already selected", () => {
  const form = readFileSync(join(process.cwd(), "app/seller/onboarding/SellerAddressOnboardingForm.tsx"), "utf8");
  assert.match(form, /sellerIntent \? sellerOnboardingPath\(locale, true, sellerIntent\) : `\/\$\{locale\}\/seller\/subscription`/);
  assert.match(readFileSync(join(process.cwd(), "app/seller/subscription/page.tsx"), "utf8"), /<SubscriptionPlans/);
});
