import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reconcilePendingSellerStoreActivation, reconcilePendingSellerStoreActivationsForOwner } from "../lib/seller-store-activation";

const now = new Date("2026-10-11T12:00:00.000Z");

function activationFixture(overrides: Record<string, unknown> = {}) {
  const store: any = {
    id: "store_primary", ownerId: "seller_1", businessId: "business_1", name: "Seller shop", country: "FR", city: "Paris",
    businessAddress: "10 rue de test", businessPostalCode: "75001", status: "PENDING", archivedAt: null,
    sellerType: "PRIVATE", sellerLegalForm: "PRIVATE", companySubtype: null, businessRegistrationId: null,
    legalBusinessName: null, vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", vatNumber: null,
    onboardingStatus: "VERIFIED", onboardingStep: 4, marketplaceActivatedAt: null, updatedAt: now, establishmentId: null,
    owner: { role: "SELLER", blockedAt: null, blockExpiresAt: null, sellerSuspendedAt: null, deactivatedAt: null, anonymizedAt: null,
      stripeAccountId: "acct_current", stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true },
    business: { id: "business_1", ownerId: "seller_1", primaryStoreId: "store_primary", billingStoreId: "store_primary", siren: null,
      inseeVerificationState: "NOT_STARTED", sellerClosedAt: null, reactivationStockReviewRequired: false },
    establishment: null,
    ...overrides,
  };
  const mutations: any[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    store: {
      findMany: async () => [{ id: store.id }],
      findUnique: async () => store,
      updateMany: async (args: any) => { mutations.push(args); if (args.where.updatedAt === store.updatedAt && store.status === "PENDING") { store.status = "ACTIVE"; store.marketplaceActivatedAt = args.data.marketplaceActivatedAt; return { count: 1 }; } return { count: 0 }; },
    },
    sellerBusiness: { findUnique: async () => ({
      primaryStoreId: store.business.primaryStoreId, billingStoreId: store.business.billingStoreId,
      owner: { role: "SELLER" }, billingStore: { id: store.business.billingStoreId, subscription: null, accessGrants: [] },
    }) },
  };
  return { tx, store, mutations };
}

test("verified seller activates only after every independent gate passes and reconciliation is idempotent", async () => {
  const fixture = activationFixture();
  assert.deepEqual(await reconcilePendingSellerStoreActivation(fixture.tx, "store_primary", now), { activated: true, reason: "ACTIVATED" });
  assert.equal(fixture.store.status, "ACTIVE");
  assert.equal(fixture.store.marketplaceActivatedAt, now);
  assert.equal(fixture.mutations.length, 1);
  assert.deepEqual(await reconcilePendingSellerStoreActivation(fixture.tx, "store_primary", now), { activated: false, reason: "NOT_ELIGIBLE_STATE" });
  assert.equal(fixture.mutations.length, 1);
});

test("owner reconciliation activates all verified pending stores and reports each genuine blocker", async () => {
  const fixture = activationFixture();
  const result = await reconcilePendingSellerStoreActivationsForOwner(fixture.tx, "seller_1", now);
  assert.deepEqual(result, { activatedStoreIds: ["store_primary"], blocked: [] });
  assert.equal(fixture.store.status, "ACTIVE");

  const blocked = activationFixture({ owner: { ...activationFixture().store.owner, stripePayoutsEnabled: false } });
  assert.deepEqual(await reconcilePendingSellerStoreActivationsForOwner(blocked.tx, "seller_1", now), {
    activatedStoreIds: [], blocked: [{ storeId: "store_primary", reason: "STRIPE_CONNECT_NOT_READY" }],
  });
  assert.equal(blocked.store.status, "PENDING");
});

test("reconciliation never activates an exceptional-review, incomplete, suspended, or Connect-incomplete seller", async () => {
  const cases: Array<[string, Record<string, any>, string]> = [
    ["manual review", { onboardingStatus: "PENDING_REVIEW" }, "NOT_ELIGIBLE_STATE"],
    ["unverified setup", { onboardingStep: 3 }, "NOT_ELIGIBLE_STATE"],
    ["Connect absent", { owner: { ...activationFixture().store.owner, stripeAccountId: null } }, "STRIPE_CONNECT_NOT_READY"],
    ["charges disabled", { owner: { ...activationFixture().store.owner, stripeChargesEnabled: false } }, "STRIPE_CONNECT_NOT_READY"],
    ["payouts disabled", { owner: { ...activationFixture().store.owner, stripePayoutsEnabled: false } }, "STRIPE_CONNECT_NOT_READY"],
    ["suspended", { owner: { ...activationFixture().store.owner, sellerSuspendedAt: now } }, "SELLER_SETUP_INCOMPLETE"],
    ["closed business", { business: { ...activationFixture().store.business, sellerClosedAt: now } }, "SELLER_SETUP_INCOMPLETE"],
  ];
  for (const [label, overrides, reason] of cases) {
    const fixture = activationFixture(overrides);
    assert.deepEqual(await reconcilePendingSellerStoreActivation(fixture.tx, "store_primary", now), { activated: false, reason }, label);
    assert.equal(fixture.mutations.length, 0, label);
  }
});

test("reconciliation requires an active commercial entitlement and an allowed primary/PRO store", async () => {
  const inactive = activationFixture();
  inactive.tx.sellerBusiness.findUnique = async () => ({ primaryStoreId: "store_primary", billingStoreId: null, owner: { role: "SELLER" }, billingStore: null });
  assert.equal((await reconcilePendingSellerStoreActivation(inactive.tx, "store_primary", now)).reason, "COMMERCIAL_ENTITLEMENT_INACTIVE");
  assert.equal(inactive.mutations.length, 0);

  const secondary = activationFixture({ id: "store_secondary", business: { ...activationFixture().store.business, primaryStoreId: "store_primary" } });
  assert.equal((await reconcilePendingSellerStoreActivation(secondary.tx, "store_secondary", now)).reason, "COMMERCIAL_ENTITLEMENT_INACTIVE");
  assert.equal(secondary.mutations.length, 0);
});

test("French professional activation requires matching verified INSEE legal-unit and establishment records", async () => {
  const fixture = activationFixture({
    sellerType: "PROFESSIONAL", sellerLegalForm: "SOLE_TRADER", businessRegistrationId: "73282932000074",
    legalBusinessName: "Verified business", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
    establishmentId: "establishment_1",
    business: { ...activationFixture().store.business, siren: "732829320", inseeVerificationState: "VERIFIED" },
    establishment: { id: "establishment_1", siret: "73282932000074", legalUnitSiren: "732829320", verificationState: "VERIFIED" },
  });
  assert.equal((await reconcilePendingSellerStoreActivation(fixture.tx, "store_primary", now)).activated, true);

  const unverified = activationFixture({
    sellerType: "PROFESSIONAL", sellerLegalForm: "SOLE_TRADER", businessRegistrationId: "73282932000074",
    legalBusinessName: "Unverified business", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE",
    establishmentId: "establishment_1",
    business: { ...activationFixture().store.business, siren: "732829320", inseeVerificationState: "MANUAL_REVIEW" },
    establishment: { id: "establishment_1", siret: "73282932000074", legalUnitSiren: "732829320", verificationState: "MANUAL_REVIEW" },
  });
  assert.equal((await reconcilePendingSellerStoreActivation(unverified.tx, "store_primary", now)).reason, "BUSINESS_VERIFICATION_INCOMPLETE");
  assert.equal(unverified.mutations.length, 0);
});

test("every final readiness transition invokes the same safe pending-store reconciler", () => {
  const statusRoute = readFileSync(join(process.cwd(), "app/api/stripe/connect/status/route.ts"), "utf8");
  const paymentEvents = readFileSync(join(process.cwd(), "lib/payments.ts"), "utf8");
  const onboardingReview = readFileSync(join(process.cwd(), "app/api/admin/seller-onboarding/[storeId]/route.ts"), "utf8");
  const reviewService = readFileSync(join(process.cwd(), "lib/seller-onboarding-review.ts"), "utf8");
  const onboardingSubmit = readFileSync(join(process.cwd(), "app/api/seller/onboarding/route.ts"), "utf8");
  const adminGrants = readFileSync(join(process.cwd(), "lib/admin-access.ts"), "utf8");
  const adminPlan = readFileSync(join(process.cwd(), "lib/admin-managed-plan.ts"), "utf8");
  const productCreate = readFileSync(join(process.cwd(), "app/api/products/route.ts"), "utf8");
  const productPage = readFileSync(join(process.cwd(), "app/seller/products/page.tsx"), "utf8");
  const connectUi = readFileSync(join(process.cwd(), "components/StripeConnectSection.tsx"), "utf8");
  assert.match(statusRoute, /retrieveConnectedAccount\(seller\.stripeAccountId\)/);
  assert.match(statusRoute, /reconcilePendingSellerStoreActivationsForOwner\(tx, session\.userId\)/);
  assert.match(paymentEvents, /retrieveConnectedAccountState\(eventAccount\.id\)/);
  assert.match(paymentEvents, /reconcilePendingSellerStoreActivationsForOwner\(tx, owner\.id\)/);
  assert.match(paymentEvents, /reconcilePendingSellerStoreActivationsForOwner\(tx, store\.ownerId\)/);
  assert.match(onboardingSubmit, /reconcilePendingSellerStoreActivation\(tx, store\.id\)/);
  assert.match(onboardingReview, /reconcilePendingSellerStoreActivation\(tx,storeId\)/);
  assert.match(adminGrants, /reconcilePendingSellerStoreActivationsForOwner\(db, target\.ownerId, now\)/);
  assert.match(adminPlan, /reconcilePendingSellerStoreActivationsForOwner\(tx, state\.target\.owner\.id, now\)/);
  assert.match(reviewService, /decision==="VERIFIED"\?"PENDING"/);
  assert.match(productCreate, /status === "PUBLISHED" \? "PRODUCT_PUBLISH" : "PRODUCT_CREATE"/);
  assert.match(connectUi, /storeActivated[\s\S]{0,100}router\.refresh\(\)/);
  assert.match(productPage, /manualReviewPending=store\.onboardingStatus==="PENDING_REVIEW"/);
  assert.doesNotMatch(productPage, /store\.status==="PENDING"\s*\?\s*freeCopy\.storeReviewTitle/);
});
