import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { CheckoutError, createCheckout, processStripeEvent } from "../lib/payments";
import { verifyStripeWebhook, type StripeEvent } from "../lib/stripe";

function checkoutDb(stock = 5, sellerReady = true) {
  let order: any = null;
  let creates = 0;
  const product = { id: "prod_1", name: "Produit", price: new Prisma.Decimal("12.50"), currency: "EUR", stock, storeId: "store_1", store: { owner: { stripeAccountId: sellerReady ? "acct_seller" : null, stripeOnboardingComplete: sellerReady, stripeChargesEnabled: sellerReady } } };
  const db: any = {
    order: {
      findUnique: async () => order,
      findUniqueOrThrow: async () => order,
      create: async ({ data }: any) => { creates++; order = { id: "order_1", status: "PENDING", stripeCheckoutSessionId: null, stripeCheckoutUrl: null, ...data, items: [{ productId: "prod_1", quantity: data.items.create[0].quantity, unitPrice: product.price }] }; return order; },
      update: async ({ data }: any) => { Object.assign(order, data); return order; },
    },
    product: { findMany: async () => [product] },
    user: { findUniqueOrThrow: async () => ({ email: "buyer@example.com" }) },
  };
  return { db, product, getCreates: () => creates };
}

test("successful payment marks order paid and decrements stock once", async () => {
  const state = { stock: 2, status: "PENDING" };
  const tx: any = {
    stripeWebhookEvent: { create: async () => ({}) },
    order: {
      findUnique: async () => ({ id: "order_1", status: state.status, stripeCheckoutSessionId: "cs_1", items: [{ productId: "prod_1", quantity: 2 }] }),
      update: async ({ data }: any) => { state.status = data.status; return {}; },
      updateMany: async () => ({ count: 0 }),
    },
    product: { updateMany: async ({ where, data }: any) => { if (state.stock < where.stock.gte) return { count: 0 }; state.stock -= data.stock.decrement; return { count: 1 }; } },
  };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1" } } } };
  assert.deepEqual(await processStripeEvent(db, event), { paid: true });
  assert.equal(state.status, "PAID"); assert.equal(state.stock, 0);
});

test("failed or expired checkout cancels only a pending order", async () => {
  let cancelled = false;
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { updateMany: async ({ where }: any) => { assert.equal(where.status, "PENDING"); cancelled = true; return { count: 1 }; } } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_cancel", type: "checkout.session.expired", data: { object: { id: "cs_1", payment_intent: null, payment_status: "unpaid", client_reference_id: "order_1" } } };
  assert.deepEqual(await processStripeEvent(db, event), { cancelled: true }); assert.equal(cancelled, true);
});

test("duplicate checkout request creates one order and one Stripe session", async () => {
  const fixture = checkoutDb(); let stripeCalls = 0;
  const stripe: any = async () => { stripeCalls++; return { id: "cs_1", url: "https://checkout.stripe.test/cs_1" }; };
  const input = [{ productId: "prod_1", quantity: 1 }];
  const first = await createCheckout(fixture.db, "buyer_1", "request_123", input, stripe);
  const second = await createCheckout(fixture.db, "buyer_1", "request_123", input, stripe);
  assert.equal(first.orderId, second.orderId); assert.equal(second.reused, true);
  assert.equal(fixture.getCreates(), 1); assert.equal(stripeCalls, 1);
});

test("destination checkout calculates and stores the platform commission", async () => {
  const fixture = checkoutDb(); let stripeInput: any;
  const stripe: any = async (input: any) => { stripeInput = input; return { id: "cs_fee", url: "https://checkout.stripe.test/cs_fee" }; };
  await createCheckout(fixture.db, "buyer_1", "request_fee", [{ productId: "prod_1", quantity: 2 }], stripe);
  assert.equal(stripeInput.connectedAccountId, "acct_seller");
  assert.equal(stripeInput.platformFeeAmount, 250);
});

test("checkout rejects sellers that cannot accept Connect charges", async () => {
  const fixture = checkoutDb(5, false);
  await assert.rejects(() => createCheckout(fixture.db, "buyer_1", "request_not_ready", [{ productId: "prod_1", quantity: 1 }]), (error: unknown) => error instanceof CheckoutError && error.message === "SELLER_STRIPE_NOT_READY");
});

test("duplicate webhook event is acknowledged without processing", async () => {
  const db: any = { $transaction: async (callback: any) => callback({ stripeWebhookEvent: { create: async () => { throw { code: "P2002" }; } } }) };
  const event: StripeEvent = { id: "evt_duplicate", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1" } } };
  assert.deepEqual(await processStripeEvent(db, event), { duplicate: true });
});

test("account.updated synchronizes connected seller capabilities", async () => {
  let update: any;
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, user: { updateMany: async (args: any) => { update = args; return { count: 1 }; } } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_account", type: "account.updated", data: { object: { id: "acct_seller", object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: false } } };
  assert.deepEqual(await processStripeEvent(db, event), { accountUpdated: true });
  assert.equal(update.where.stripeAccountId, "acct_seller"); assert.equal(update.data.stripeChargesEnabled, true);
});

test("paid webhook rejects a mismatched destination account", async () => {
  const tx: any = { stripeWebhookEvent: { create: async () => ({}) }, order: { findUnique: async () => ({ id: "order_1", status: "PENDING", stripeCheckoutSessionId: "cs_1", stripeConnectedAccountId: "acct_expected", items: [] }) } };
  const db: any = { $transaction: (callback: any) => callback(tx) };
  const event: StripeEvent = { id: "evt_wrong_destination", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1", metadata: { orderId: "order_1", connectedAccountId: "acct_wrong" } } } };
  await assert.rejects(() => processStripeEvent(db, event), /destination account/);
});

test("checkout rejects insufficient stock before creating an order", async () => {
  const fixture = checkoutDb(1);
  await assert.rejects(() => createCheckout(fixture.db, "buyer_1", "request_123", [{ productId: "prod_1", quantity: 2 }]), (error: unknown) => error instanceof CheckoutError && error.status === 409);
  assert.equal(fixture.getCreates(), 0);
});

test("webhook signature rejection blocks altered payloads", () => {
  const secret = "whsec_test"; const timestamp = Math.floor(Date.now() / 1000); const body = JSON.stringify({ id: "evt_1" });
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`, secret).id, "evt_1");
  assert.throws(() => verifyStripeWebhook(`${body} `, `t=${timestamp},v1=${signature}`, secret), /Invalid Stripe webhook signature/);
});

test("subscription Checkout retrieves Stripe subscription and activates the local seller", async () => {
  let storeUpdate: any;
  let subscriptionUpsert: any;
  const tx: any = {
    stripeWebhookEvent: { create: async () => ({}) },
    sellerSubscription: {
      findFirst: async () => ({ storeId: "store_1", plan: "basic", stripePriceId: "price_basic" }),
      upsert: async (args: any) => { subscriptionUpsert = args; return {}; },
    },
    store: {
      findUnique: async () => ({ id: "store_1", ownerId: "seller_1", stripeCustomerId: "cus_1" }),
      update: async (args: any) => { storeUpdate = args; return {}; },
    },
    product: { updateMany: async () => ({ count: 2 }) },
  };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const event: StripeEvent = {
    id: "evt_subscription_checkout",
    type: "checkout.session.completed",
    data: { object: { id: "cs_sub", mode: "subscription", customer: "cus_1", subscription: "sub_1", payment_intent: null, payment_status: "paid", client_reference_id: "store_1", metadata: { kind: "seller_subscription", storeId: "store_1", userId: "seller_1", plan: "basic" } } },
  };
  const retrieve = async () => ({ id: "sub_1", object: "subscription" as const, customer: "cus_1", status: "active", metadata: { storeId: "store_1", plan: "basic" }, items: { data: [{ price: { id: "price_basic" }, current_period_end: 1_800_000_000 }] } });
  assert.deepEqual(await processStripeEvent(db, event, retrieve), { subscriptionCheckoutCompleted: true, storeId: "store_1", status: "ACTIVE" });
  assert.equal(storeUpdate.data.stripeCustomerId, "cus_1");
  assert.equal(storeUpdate.data.status, "ACTIVE");
  assert.equal(subscriptionUpsert.update.stripeSubscriptionId, "sub_1");
  assert.equal(subscriptionUpsert.update.stripePriceId, "price_basic");
  assert.equal(subscriptionUpsert.update.status, "ACTIVE");
  assert.equal(subscriptionUpsert.update.currentPeriodEnd.toISOString(), new Date(1_800_000_000 * 1000).toISOString());
});
