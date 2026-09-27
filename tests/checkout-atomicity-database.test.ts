import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CheckoutError, createCheckout } from "../lib/payments";
import { buyerLoyaltySummary } from "../lib/loyalty-ledger";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;

test("failed loyalty checkout rolls back its order and the corrected same-key retry is idempotent", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const buyer = await db.user.findUniqueOrThrow({ where: { email: "buyer@review.local" } });
    const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } } });
    const product = await db.product.findFirstOrThrow({ where: { storeId: store.id, status: "PUBLISHED", loyaltyEligible: true, variants: { none: {} }, stock: { gte: 1 } }, orderBy: { price: "desc" } });
    const summary = await buyerLoyaltySummary(db, buyer.id);
    const available = summary.stores.find(row => row.storeId === store.id)?.availableMinor ?? 0;
    const overBalance = available + 1;
    assert.ok(overBalance > 0 && overBalance <= Number(product.price) * 100);
    const requestId = `atomic-${randomUUID()}`;
    let providerCalls = 0;
    const provider = async () => {
      providerCalls += 1;
      return { id: `cs_test_atomic_${requestId}`, url: `https://checkout.stripe.test/${requestId}` };
    };
    const pricing = { stripeMode: "test" as const, redeemByStore: { [store.id]: overBalance }, retrieveConnectedAccount: async (id: string) => ({ id, object: "account" as const, details_submitted: true, charges_enabled: true, payouts_enabled: true }) };
    const items = [{ productId: product.id, quantity: 1 }];
    await assert.rejects(createCheckout(db, buyer.id, requestId, items, provider, "FR", undefined, pricing),
      (error: unknown) => error instanceof CheckoutError && error.message === "LOYALTY_BALANCE_INSUFFICIENT");
    assert.equal(await db.order.count({ where: { buyerId: buyer.id, checkoutRequestId: requestId } }), 0);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: { checkoutRequestId: requestId } }), 0);
    assert.equal(providerCalls, 0);

    const corrected = { ...pricing, redeemByStore: {} };
    const first = await createCheckout(db, buyer.id, requestId, items, provider, "FR", undefined, corrected);
    const second = await createCheckout(db, buyer.id, requestId, items, provider, "FR", undefined, corrected);
    assert.equal(first.orderId, second.orderId);
    assert.equal(second.reused, true);
    assert.equal(providerCalls, 1);
    assert.equal(await db.order.count({ where: { buyerId: buyer.id, checkoutRequestId: requestId } }), 1);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: { checkoutRequestId: requestId } }), 0);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, product.stock);
  } finally {
    await db.$disconnect();
  }
});

test("concurrent same-key checkout creates one order without stock or loyalty consumption", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const buyer = await db.user.findUniqueOrThrow({ where: { email: "buyer@review.local" } });
    const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } } });
    const product = await db.product.findFirstOrThrow({ where: { storeId: store.id, status: "PUBLISHED", variants: { none: {} }, stock: { gte: 1 } } });
    const requestId = `parallel-${randomUUID()}`;
    let providerCalls = 0;
    const provider = async () => {
      providerCalls += 1;
      return { id: `cs_test_parallel_${requestId}`, url: `https://checkout.stripe.test/${requestId}` };
    };
    const pricing = { stripeMode: "test" as const, retrieveConnectedAccount: async (id: string) => ({ id, object: "account" as const, details_submitted: true, charges_enabled: true, payouts_enabled: true }) };
    const create = () => createCheckout(db, buyer.id, requestId, [{ productId: product.id, quantity: 1 }], provider, "FR", undefined, pricing);
    const results = await Promise.allSettled([create(), create()]);
    assert.deepEqual(results.map(row => row.status), ["fulfilled", "fulfilled"]);
    assert.equal(await db.order.count({ where: { buyerId: buyer.id, checkoutRequestId: requestId } }), 1);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: { checkoutRequestId: requestId } }), 0);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, product.stock);
    assert.ok(providerCalls >= 1 && providerCalls <= 2);
    const replay = await create();
    assert.equal(replay.reused, true);
  } finally {
    await db.$disconnect();
  }
});
