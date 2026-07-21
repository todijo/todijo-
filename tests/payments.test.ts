import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { CheckoutError, createCheckout, processStripeEvent } from "../lib/payments";
import { verifyStripeWebhook, type StripeEvent } from "../lib/stripe";

function checkoutDb(stock = 5) {
  let order: any = null;
  let creates = 0;
  const product = { id: "prod_1", name: "Produit", price: new Prisma.Decimal("12.50"), currency: "EUR", stock };
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

test("duplicate webhook event is acknowledged without processing", async () => {
  const db: any = { $transaction: async (callback: any) => callback({ stripeWebhookEvent: { create: async () => { throw { code: "P2002" }; } } }) };
  const event: StripeEvent = { id: "evt_duplicate", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid", client_reference_id: "order_1" } } };
  assert.deepEqual(await processStripeEvent(db, event), { duplicate: true });
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
