import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advanceSellerFulfillment, FulfillmentError } from "../lib/fulfillment";

function database(order: any, stores = [{ id: "store_1" }]) {
  const updates: any[] = [];
  const events: any[] = [];
  const notifications: any[] = [];
  const storeOwners: string[] = [];
  const tx = {
    store: { findMany: async ({ where }: any) => { storeOwners.push(where.ownerId); return stores; } },
    order: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.id, "order_1");
        assert.deepEqual(where.OR[0], { storeIdSnapshot: { in: stores.map((store) => store.id) } });
        return order;
      },
      update: async ({ data }: any) => { updates.push(data); return { ...order, ...data, id: "order_1" }; },
    },
    orderFulfillmentEvent: { create: async ({ data }: any) => { events.push(data); return data; } }, orderLifecycleEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
    notification: { create: async ({ data }: any) => { notifications.push(data); return data; } },
  };
  return { db: { $transaction: async (callback: any) => callback(tx) } as any, updates, events, notifications, storeOwners };
}

test("seller with an owned order can advance only the next forward fulfillment transition with tracking", async () => {
  const { db, updates, events, notifications, storeOwners } = database({ id: "order_1", buyerId: "buyer_1", status: "PROCESSING" });
  const result = await advanceSellerFulfillment(db, "seller_1", "order_1", "PROCESSING", { trackingCarrier: "  La Poste  ", trackingNumber: " AB  123 " });
  assert.equal(result.idempotent, false);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "SHIPPED");
  assert.equal(updates[0].fulfillmentStatus, "SHIPPED");
  assert.equal(updates[0].trackingCarrier, "La Poste");
  assert.equal(updates[0].trackingNumber, "AB 123");
  assert.equal(events[0].source, "SELLER");
  assert.equal(events[0].status, "SHIPPED");
  assert.deepEqual(notifications, [{ userId: "buyer_1", type: "ORDER_SHIPPED", title: "Order shipped", body: "Your order has been shipped.", href: "/account/orders/order_1" }]);
  assert.deepEqual(storeOwners, ["seller_1"]);
});

test("admin with an owned store can use the same owned-order transition", async () => {
  const { db, updates, storeOwners } = database({ id: "order_1", status: "PAID" });
  await advanceSellerFulfillment(db, "admin_owner", "order_1", "PAID");
  assert.equal(updates[0].status, "PROCESSING");
  assert.deepEqual(storeOwners, ["admin_owner"]);
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
  const { db, updates, events, notifications } = database({ id: "order_1", buyerId: "buyer_1", status: "SHIPPED" });
  const result = await advanceSellerFulfillment(db, "seller_1", "order_1", "PROCESSING");
  assert.equal(result.idempotent, true);
  assert.equal(updates.length, 0);
  assert.equal(events.length, 0);
  assert.equal(notifications.length, 0);
});

test("delivered transition notifies only the owning buyer with the order-detail link", async () => {
  const { db, notifications } = database({ id: "order_1", buyerId: "buyer_1", status: "SHIPPED" });
  await advanceSellerFulfillment(db, "seller_1", "order_1", "SHIPPED");
  assert.deepEqual(notifications, [{ userId: "buyer_1", type: "ORDER_DELIVERED", title: "Order delivered", body: "Your order has been delivered.", href: "/account/orders/order_1" }]);
});

test("admin without ownership and a foreign seller are rejected", async () => {
  const { db } = database(null, []);
  for (const userId of ["admin_without_store", "foreign_seller"]) {
    await assert.rejects(async () => advanceSellerFulfillment(db, userId, "order_1", "PAID"), (error: any) => error instanceof FulfillmentError && error.status === 404);
  }
});

test("fulfillment route permits seller-capable sessions but relies on owned-store authorization", () => {
  const route = readFileSync(join(process.cwd(), "app", "api", "seller", "orders", "[orderId]", "fulfillment", "route.ts"), "utf8");
  assert.match(route, /\["SELLER", "ADMIN"\]\.includes\(session\.role\)/);
  assert.match(route, /advanceSellerFulfillment\(prisma, session\.userId/);
});

test("tracking values are rejected outside the shipping transition", async () => {
  const { db } = database({ id: "order_1", status: "PAID" });
  await assert.rejects(() => advanceSellerFulfillment(db, "seller_1", "order_1", "PAID", { trackingNumber: "AB123" }), FulfillmentError);
});
