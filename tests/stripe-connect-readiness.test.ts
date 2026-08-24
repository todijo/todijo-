import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connectReadinessCounts, connectReadinessState, maskedStripeAccountId } from "../lib/connect-readiness";
import { processEligibleSellerTransfer } from "../lib/seller-transfers";
import { connectedAccountReady } from "../lib/stripe";

const account = (overrides: Partial<{ id: string; details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean }> = {}) => ({
  id: "acct_ready", object: "account" as const, details_submitted: true, charges_enabled: true, payouts_enabled: true, ...overrides,
});

test("Connect readiness requires the expected account plus onboarding, charges, and payouts", () => {
  assert.equal(connectedAccountReady(account(), "acct_ready"), true);
  assert.equal(connectedAccountReady(account({ id: "acct_other" }), "acct_ready"), false);
  assert.equal(connectedAccountReady(account({ details_submitted: false }), "acct_ready"), false);
  assert.equal(connectedAccountReady(account({ charges_enabled: false }), "acct_ready"), false);
  assert.equal(connectedAccountReady(account({ payouts_enabled: false }), "acct_ready"), false);
});

test("read-only admin counts expose every migration readiness category", () => {
  const counts = connectReadinessCounts([
    { stripeAccountId: null, stripeOnboardingComplete: false, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    { stripeAccountId: "acct_incomplete", stripeOnboardingComplete: false, stripeChargesEnabled: false, stripePayoutsEnabled: false },
    { stripeAccountId: "acct_ready", stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true },
  ]);
  assert.deepEqual(counts, { total: 3, withAccount: 2, withoutAccount: 1, incompleteOnboarding: 2, chargesDisabled: 2, payoutsDisabled: 2, ready: 1, compliance: "ACTION_REQUIRED" });
});

test("admin compliance becomes COMPLIANT only when every seller is fully ready", () => {
  const ready = { stripeAccountId: "acct_ready_123456", stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true };
  assert.equal(connectReadinessCounts([ready, ready]).compliance, "COMPLIANT");
  assert.equal(connectReadinessState({ ...ready, stripeAccountId: null }), "NOT_STARTED");
  assert.equal(connectReadinessState({ ...ready, stripeOnboardingComplete: false }), "ONBOARDING_INCOMPLETE");
  assert.equal(connectReadinessState({ ...ready, stripeChargesEnabled: false }), "CHARGES_DISABLED");
  assert.equal(connectReadinessState({ ...ready, stripePayoutsEnabled: false }), "PAYOUTS_DISABLED");
  assert.equal(connectReadinessState(ready), "READY");
  assert.equal(maskedStripeAccountId(ready.stripeAccountId), "••••123456");
  assert.equal(maskedStripeAccountId(null), "—");
});

test("admin compliance view identifies sellers and gives a safe remediation path", () => {
  const page = readFileSync(join(process.cwd(), "app/adm-barewbar-182203/connect-readiness/page.tsx"), "utf8");
  assert.match(page, /requireAdmin/);
  assert.match(page, /Seller readiness register/);
  assert.match(page, /ACTION REQUIRED/);
  assert.match(page, /Dashboard → Connect Stripe/);
  assert.match(page, /maskedStripeAccountId/);
  assert.doesNotMatch(page, /createConnectedAccount|STRIPE_SECRET_KEY/);
});

test("seller transfer validates the current authoritative account before submission", async () => {
  let submitted = 0; const updates: any[] = [];
  const db: any = {
    orderGroup: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ id: "group_1", orderId: "order_1", stripeConnectedAccountId: "acct_ready", sellerNetAmountMinor: 900, transferIdempotencyKey: "transfer_1", store: { owner: { id: "seller_1", stripeAccountId: "acct_ready" } }, order: { currency: "EUR" } }), update: async ({ data }: any) => { updates.push(data); return {}; } },
    user: { update: async () => ({}) },
  };
  const result = await processEligibleSellerTransfer(db, "group_1", new Date(), async () => { submitted += 1; return { id: "tr_1" }; }, async () => account());
  assert.deepEqual(result, { transferred: true, id: "tr_1" }); assert.equal(submitted, 1); assert.equal(updates.at(-1).transferStatus, "TRANSFERRED");
});

test("seller transfer cannot pay a stale, missing, or disabled authoritative account", async () => {
  for (const currentId of [null, "acct_replaced"] as const) {
    let submitted = 0;
    const db: any = { orderGroup: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ id: "group_1", orderId: "order_1", stripeConnectedAccountId: "acct_snapshot", sellerNetAmountMinor: 900, transferIdempotencyKey: "transfer_1", store: { owner: { id: "seller_1", stripeAccountId: currentId } }, order: { currency: "EUR" } }), update: async () => ({}) }, user: { update: async () => ({}) } };
    await assert.rejects(() => processEligibleSellerTransfer(db, "group_1", new Date(), async () => { submitted += 1; return { id: "never" }; }, async () => account()), /no longer matches/);
    assert.equal(submitted, 0);
  }
  let submitted = 0;
  const disabledDb: any = { orderGroup: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ id: "group_1", orderId: "order_1", stripeConnectedAccountId: "acct_ready", sellerNetAmountMinor: 900, transferIdempotencyKey: "transfer_1", store: { owner: { id: "seller_1", stripeAccountId: "acct_ready" } }, order: { currency: "EUR" } }), update: async () => ({}) }, user: { update: async () => ({}) } };
  await assert.rejects(() => processEligibleSellerTransfer(disabledDb, "group_1", new Date(), async () => { submitted += 1; return { id: "never" }; }, async () => account({ payouts_enabled: false })), /not ready/);
  assert.equal(submitted, 0);
});

test("checkout covers every marketplace store while CJ remains platform-owned", () => {
  const source = readFileSync(join(process.cwd(), "lib/payments.ts"), "utf8");
  assert.match(source, /for\(const store of marketplaceStores\)/);
  assert.match(source, /connectedAccountReady\(account,store\.owner\.stripeAccountId\)/);
  assert.match(source, /key==="cj:platform"\?null/);
});

test("onboarding reuses existing accounts and account creation is idempotent, never a mass migration", () => {
  const route = readFileSync(join(process.cwd(), "app/api/stripe/connect/account/route.ts"), "utf8");
  const stripe = readFileSync(join(process.cwd(), "lib/stripe.ts"), "utf8");
  assert.match(route, /if \(!accountId\)/); assert.match(route, /createConnectedAccountLink\(accountId\)/);
  assert.match(stripe, /connect-account-v2:\$\{input\.userId\}/);
  assert.doesNotMatch(route, /findMany|updateMany/);
});

test("seller UX explicitly distinguishes pending capability states from ready", () => {
  const panel = readFileSync(join(process.cwd(), "components/StripeConnectSection.tsx"), "utf8");
  assert.match(panel, /status\.connected && status\.onboardingComplete && status\.chargesEnabled && status\.payoutsEnabled/);
  assert.match(panel, /ready \? `✓/);
  assert.match(panel, /status\.chargesEnabled \? "✓ " : "✕ "/);
  assert.match(panel, /status\.payoutsEnabled \? "✓ " : "✕ "/);
});

test("protected Stripe and financial history remains physically undeletable", () => {
  const deletion = readFileSync(join(process.cwd(), "lib/admin-user-deletion.ts"), "utf8");
  assert.match(deletion, /STRIPE_CONNECTED_ACCOUNT/);
  assert.match(deletion, /BUYER_ORDERS/);
  assert.match(deletion, /SELLER_ORDER_HISTORY/);
  assert.match(deletion, /ADMIN_AUDIT_HISTORY/);
  assert.match(deletion, /if\(!preview\.hardDeleteSafe\)/);
});
