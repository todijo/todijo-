import assert from "node:assert/strict";
import test from "node:test";
import { localCheckoutProvider, localCheckoutProviderEnabled,
  LocalCheckoutProviderFailure } from "../lib/local-checkout-provider";

const local = { NODE_ENV: "test", TODIJO_LOCAL_CHECKOUT_PROVIDER: "enabled",
  STRIPE_MODE: "test", DATABASE_URL:
    "postgresql://e2e@127.0.0.1:55432/todijo_e2e?schema=public",
  APP_URL: "http://127.0.0.1:3001" };

test("local provider fails closed unless every server-side disposable guard holds", () => {
  assert.equal(localCheckoutProviderEnabled(local), true);
  for (const changed of [
    { NODE_ENV: "production" }, { NODE_ENV: "staging" },
    { TODIJO_LOCAL_CHECKOUT_PROVIDER: "" }, { STRIPE_MODE: "live" },
    { STRIPE_SECRET_KEY: "present" },
    { APP_URL: "https://todijo.com" },
    { DATABASE_URL: "postgresql://e2e@localhost:55432/todijo_e2e" },
    { DATABASE_URL: "postgresql://e2e@127.0.0.1:5432/todijo_e2e" },
    { DATABASE_URL: "postgresql://e2e@127.0.0.1:55432/production" },
  ]) assert.equal(localCheckoutProvider({ ...local, ...changed }), null);
});

test("local provider accepts only local fixture accounts and creates no payment", async () => {
  const provider = localCheckoutProvider(local);
  assert.ok(provider);
  await assert.rejects(provider.retrieveConnectedAccount("acct_live_real"),
    LocalCheckoutProviderFailure);
  const account = await provider.retrieveConnectedAccount("acct_test_local_review");
  assert.equal(account.charges_enabled, true);
  const input = { orderId: "order_local", idempotencyKey: "checkout:buyer:key",
    email: "buyer@review.local", items: [], allowedCountries: ["FR"],
    shipping: { name: "Local", amount: 0, currency: "EUR", minDays: 1,
      maxDays: 2 } } as Parameters<typeof provider.stripeCreate>[0];
  const first = await provider.stripeCreate(input);
  const replay = await provider.stripeCreate(input);
  assert.equal(first.id, replay.id);
  assert.match(first.id, /^cs_test_local_[a-f0-9]{32}$/);
  assert.match(first.url, /^https:\/\/checkout\.stripe\.test\/local-review\//);
  const rejected = localCheckoutProvider({ ...local,
    TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME: "reject" });
  assert.ok(rejected);
  await assert.rejects(rejected.stripeCreate(input), LocalCheckoutProviderFailure);
});
