import assert from "node:assert/strict";
import test from "node:test";
import { connectedAccountIdempotencyKey, startStripeConnectOnboarding } from "../lib/stripe-connect-onboarding";
import { StripeApiError, StripeTransportError, stripeErrorDiagnostic, type StripeConnectedAccount } from "../lib/stripe";

const seller = { id: "seller_1", email: "seller@example.com", stripeAccountId: null };
const account = (id = "acct_new"): StripeConnectedAccount => ({ id, object: "account", details_submitted: false, charges_enabled: false, payouts_enabled: false });

function database(input: { stripeAccountId?: string | null; generation?: number; failPersistenceOnce?: boolean } = {}) {
  const state = { id: seller.id, email: seller.email, stripeAccountId: input.stripeAccountId ?? null, stripeConnectAccountAttemptGeneration: input.generation ?? 0 };
  let failPersistenceOnce = input.failPersistenceOnce ?? false;
  const user = {
    findUnique: async () => ({ ...state }),
    updateMany: async ({ where, data }: any) => {
      if (where.id !== state.id || (where.stripeAccountId === null && state.stripeAccountId !== null) || where.stripeConnectAccountAttemptGeneration !== state.stripeConnectAccountAttemptGeneration) return { count: 0 };
      if (data.stripeAccountId && failPersistenceOnce) { failPersistenceOnce = false; throw new Error("database unavailable"); }
      if (data.stripeConnectAccountAttemptGeneration?.increment) state.stripeConnectAccountAttemptGeneration += data.stripeConnectAccountAttemptGeneration.increment;
      if (data.stripeAccountId) state.stripeAccountId = data.stripeAccountId;
      return { count: 1 };
    },
  };
  return { db: { user } as any, state };
}

const link = async (accountId: string) => `https://connect.stripe.test/${accountId}`;

test("first connected-account attempt uses the legacy generation-zero key and persists before linking", async () => {
  const { db, state } = database(); const calls: string[] = [];
  const url = await startStripeConnectOnboarding(db, seller, { createAccount: async (input) => { calls.push(input.idempotencyKey); return account(); }, createAccountLink: link });
  assert.equal(url, "https://connect.stripe.test/acct_new"); assert.deepEqual(calls, ["connect-account-v2:seller_1"]); assert.equal(state.stripeAccountId, "acct_new"); assert.equal(state.stripeConnectAccountAttemptGeneration, 0);
});

test("Stripe Connect diagnostics identify provider account_invalid safely without exposing identifiers or messages", () => {
  const previous = process.env.STRIPE_SECRET_KEY, previousMode = process.env.STRIPE_MODE;
  process.env.STRIPE_SECRET_KEY = "sk_test_diagnostic_only"; process.env.STRIPE_MODE = "test";
  try {
    const diagnostic = stripeErrorDiagnostic(new StripeApiError("invalid account acct_private for seller@example.com", "account_invalid", 403), {
      correlationId: "request-diagnostic-1", route: "GET /api/stripe/connect/status", sellerId: "seller_private", hasStoredAccount: true,
    });
    assert.equal(diagnostic.category, "provider"); assert.equal(diagnostic.code, "account_invalid"); assert.equal(diagnostic.statusCode, 403);
    assert.equal(diagnostic.correlationId, "request-diagnostic-1"); assert.equal(diagnostic.route, "GET /api/stripe/connect/status");
    assert.equal(diagnostic.stripeMode, "test"); assert.equal(diagnostic.storedAccountIdPresent, true); assert.equal(diagnostic.accountPlatformMembership, "unconfirmed_after_failure");
    assert.match(String(diagnostic.sellerRef), /^[a-f0-9]{12}$/); assert.doesNotMatch(JSON.stringify(diagnostic), /acct_private|seller_private|seller@example\.com|invalid account/);
    const transport = stripeErrorDiagnostic(new StripeTransportError("timeout while contacting Stripe"));
    assert.equal(transport.category, "transport"); assert.equal(transport.code, "unreachable"); assert.doesNotMatch(JSON.stringify(transport), /timeout while contacting Stripe/);
  } finally { if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; if (previousMode === undefined) delete process.env.STRIPE_MODE; else process.env.STRIPE_MODE = previousMode; }
});

test("ambiguous transport retries reuse the same durable idempotency key", async () => {
  const { db, state } = database(); const calls: string[] = [];
  const createAccount = async (input: { idempotencyKey: string }) => { calls.push(input.idempotencyKey); throw new StripeTransportError("timeout"); };
  await assert.rejects(() => startStripeConnectOnboarding(db, seller, { createAccount: createAccount as any, createAccountLink: link }), StripeTransportError);
  await assert.rejects(() => startStripeConnectOnboarding(db, seller, { createAccount: createAccount as any, createAccountLink: link }), StripeTransportError);
  assert.deepEqual(calls, ["connect-account-v2:seller_1", "connect-account-v2:seller_1"]); assert.equal(state.stripeConnectAccountAttemptGeneration, 0);
});

test("a definite failed attempt advances once and the next request uses a new key", async () => {
  const { db, state } = database();
  await assert.rejects(() => startStripeConnectOnboarding(db, seller, { createAccount: async () => { throw new StripeApiError("rejected", "account_invalid", 400); }, createAccountLink: link }), StripeApiError);
  assert.equal(state.stripeConnectAccountAttemptGeneration, 1); let key = "";
  await startStripeConnectOnboarding(db, seller, { createAccount: async (input) => { key = input.idempotencyKey; return account(); }, createAccountLink: link });
  assert.equal(key, "connect-account-v2:seller_1:attempt:1");
});

test("concurrent definite failures use CAS and cannot advance the generation twice", async () => {
  const { db, state } = database(); const rejected = async () => { throw new StripeApiError("rejected", "account_invalid", 400); };
  const results = await Promise.allSettled([startStripeConnectOnboarding(db, seller, { createAccount: rejected, createAccountLink: link }), startStripeConnectOnboarding(db, seller, { createAccount: rejected, createAccountLink: link })]);
  assert.deepEqual(results.map((result) => result.status), ["rejected", "rejected"]); assert.equal(state.stripeConnectAccountAttemptGeneration, 1);
});

test("an existing connected account prevents creation and only creates an account link", async () => {
  const { db, state } = database({ stripeAccountId: "acct_existing", generation: 7 }); let creates = 0;
  const url = await startStripeConnectOnboarding(db, { ...seller, stripeAccountId: "acct_existing" }, { createAccount: async () => { creates += 1; return account("acct_duplicate"); }, createAccountLink: link });
  assert.equal(url, "https://connect.stripe.test/acct_existing"); assert.equal(creates, 0); assert.equal(state.stripeAccountId, "acct_existing");
});

test("a persistence failure retries the same Stripe request and recovers the accepted account", async () => {
  const { db, state } = database({ failPersistenceOnce: true }); const keys: string[] = []; const stripeAccounts = new Map<string, StripeConnectedAccount>();
  const createAccount = async (input: { idempotencyKey: string }) => { keys.push(input.idempotencyKey); const existing = stripeAccounts.get(input.idempotencyKey); if (existing) return existing; const created = account("acct_recovered"); stripeAccounts.set(input.idempotencyKey, created); return created; };
  await assert.rejects(() => startStripeConnectOnboarding(db, seller, { createAccount: createAccount as any, createAccountLink: link }), /database unavailable/);
  assert.equal(state.stripeConnectAccountAttemptGeneration, 0);
  assert.equal(await startStripeConnectOnboarding(db, seller, { createAccount: createAccount as any, createAccountLink: link }), "https://connect.stripe.test/acct_recovered");
  assert.deepEqual(keys, ["connect-account-v2:seller_1", "connect-account-v2:seller_1"]); assert.equal(stripeAccounts.size, 1); assert.equal(state.stripeAccountId, "acct_recovered");
});

test("timeouts, conflicts, rate limits, and server responses remain ambiguous", async () => {
  for (const statusCode of [408, 409, 429, 500]) { const { db, state } = database(); await assert.rejects(() => startStripeConnectOnboarding(db, seller, { createAccount: async () => { throw new StripeApiError("retry safely", "temporary", statusCode); }, createAccountLink: link }), StripeApiError); assert.equal(state.stripeConnectAccountAttemptGeneration, 0); }
});

test("later generations have stable deterministic keys", () => {
  assert.equal(connectedAccountIdempotencyKey("seller_1", 0), "connect-account-v2:seller_1"); assert.equal(connectedAccountIdempotencyKey("seller_1", 2), "connect-account-v2:seller_1:attempt:2");
});
