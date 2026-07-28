import assert from "node:assert/strict";
import test from "node:test";
import { advanceSellerFulfillment, FulfillmentError } from "../lib/fulfillment";

function database(order: any, stores = [{ id: "store_1" }]) {
  const updates: any[] = [];
  const events: any[] = [];
  const tx = {
    store: { findMany: async () => stores },
    order: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.id, "order_1");
        assert.deepEqual(where.OR[0], { storeIdSnapshot: { in: stores.map((store) => store.id) } });
        return order;
      },
      update: async ({ data }: any) => { updates.push(data); return { ...order, ...data, id: "order_1" }; },
    },
    orderFulfillmentEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  return { db: { $transaction: async (callback: any) => callback(tx) } as any, updates, events };
}

test("seller can advance only the next forward fulfillment transition with tracking", async () => {
  const { db, updates, events } = database({ id: "order_1", status: "PROCESSING" });
  const result = await advanceSellerFulfillment(db, "seller_1", "order_1", "PROCESSING", { trackingCarrier: "  La Poste  ", trackingNumber: " AB  123 " });
  assert.equal(result.idempotent, false);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "SHIPPED");
  assert.equal(updates[0].fulfillmentStatus, "SHIPPED");
  assert.equal(updates[0].trackingCarrier, "La Poste");
  assert.equal(updates[0].trackingNumber, "AB 123");
  assert.equal(events[0].source, "SELLER");
  assert.equal(events[0].status, "SHIPPED");
});

test("shipping without new tracking preserves previously saved tracking values", async () => {
  const { db, updates } = database({ id: "order_1", status: "PROCESSING", trackingCarrier: "La Poste", trackingNumber: "AB123" });
  await advanceSellerFulfillment(db, "seller_1", "order_1", "PROCESSING");
  assert.equal(updates[0].trackingCarrier, "La Poste");
  assert.equal(updates[0].trackingNumber, "AB123");
});

test("skipped and backward fulfillment transitions are rejected without writes", async () => {
  const { db, updates, events } = database({ id: "order_1", status: "PAID" });
  await assert.rejects(() => advanceSellerFulfillment(db, "seller_1", "order_1", "SHIPPED"), FulfillmentError);
  assert.equal(updates.length, 0);
  assert.equal(events.length, 0);
});

test("repeating an already completed transition is idempotent", async () => {
  const { db, updates, events } = database({ id: "order_1", status: "SHIPPED" });
  const result = await advanceSellerFulfillment(db, "seller_1", "order_1", "PROCESSING");
  assert.equal(result.idempotent, true);
  assert.equal(updates.length, 0);
  assert.equal(events.length, 0);
});

test("an order outside the seller's stores is not updated", async () => {
  const { db } = database(null, []);
  await assert.rejects(async () => advanceSellerFulfillment(db, "seller_2", "order_1", "PAID"), (error: any) => error instanceof FulfillmentError && error.status === 404);
});

test("tracking values are rejected outside the shipping transition", async () => {
  const { db } = database({ id: "order_1", status: "PAID" });
  await assert.rejects(() => advanceSellerFulfillment(db, "seller_1", "order_1", "PAID", { trackingNumber: "AB123" }), FulfillmentError);
});
