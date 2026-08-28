import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleStripeWebhookRequest } from "../lib/stripe-webhook-request";
import type { StripeEvent } from "../lib/stripe";

const secret = "whsec_test_webhook_route";
const nowSeconds = Math.floor(Date.now() / 1000);

function payload(type = "checkout.session.completed", overrides: Partial<StripeEvent> = {}) {
  return JSON.stringify({
    id: "evt_route_1",
    type,
    livemode: false,
    data: { object: { id: "cs_test_route", payment_intent: "pi_test_route", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1" } } },
    ...overrides,
  });
}

function signature(body: string, timestamp = nowSeconds, signingSecret = secret) {
  return `t=${timestamp},v1=${createHmac("sha256", signingSecret).update(`${timestamp}.${body}`).digest("hex")}`;
}

function request(body: string, header?: string) {
  return new Request("https://todijo.com/api/stripe/webhook", { method: "POST", body, headers: header ? { "stripe-signature": header } : {} });
}

const ignored = async () => ({ ignored: true });

test("valid Stripe signature and Checkout completion return 2xx", async () => {
  const body = payload();
  let handledType = "";
  const response = await handleStripeWebhookRequest(request(body, signature(body)), {
    webhookSecret: secret,
    stripeMode: "test",
    processEvent: async (event) => { handledType = event.type; return { paid: true }; },
  });
  assert.equal(response.status, 200);
  assert.equal(handledType, "checkout.session.completed");
  assert.deepEqual(await response.json(), { received: true, paid: true });
});

test("invalid and missing Stripe signatures are rejected", async () => {
  const body = payload();
  assert.equal((await handleStripeWebhookRequest(request(body, signature(body, nowSeconds, "wrong")), { webhookSecret: secret, stripeMode: "test", processEvent: ignored })).status, 400);
  assert.equal((await handleStripeWebhookRequest(request(body), { webhookSecret: secret, stripeMode: "test", processEvent: ignored })).status, 400);
});

test("expired Stripe signature is rejected", async () => {
  const body = payload();
  const oldTimestamp = nowSeconds - 301;
  assert.equal((await handleStripeWebhookRequest(request(body, signature(body, oldTimestamp)), { webhookSecret: secret, stripeMode: "test", processEvent: ignored })).status, 400);
});

test("test/live mode mismatch is rejected before processing", async () => {
  const body = payload("checkout.session.completed", { livemode: true });
  let processed = false;
  const response = await handleStripeWebhookRequest(request(body, signature(body)), { webhookSecret: secret, stripeMode: "test", processEvent: async () => { processed = true; return { ignored: true }; } });
  assert.equal(response.status, 400);
  assert.equal(processed, false);
});

test("duplicate webhook delivery remains idempotent", async () => {
  const body = payload();
  const seen = new Set<string>();
  let mutations = 0;
  const processEvent = async (event: StripeEvent) => {
    if (seen.has(event.id)) return { duplicate: true };
    seen.add(event.id);
    mutations += 1;
    return { paid: true };
  };
  const dependencies = { webhookSecret: secret, stripeMode: "test" as const, processEvent };
  assert.equal((await handleStripeWebhookRequest(request(body, signature(body)), dependencies)).status, 200);
  const replay = await handleStripeWebhookRequest(request(body, signature(body)), dependencies);
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
  assert.equal(mutations, 1);
});

test("signed malformed payload is safely rejected", async () => {
  const body = "{not-json";
  assert.equal((await handleStripeWebhookRequest(request(body, signature(body)), { webhookSecret: secret, stripeMode: "test", processEvent: ignored })).status, 400);
});

test("unsupported valid event is safely acknowledged", async () => {
  const body = payload("radar.early_fraud_warning.created");
  const response = await handleStripeWebhookRequest(request(body, signature(body)), { webhookSecret: secret, stripeMode: "test", processEvent: ignored });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, ignored: true });
});
