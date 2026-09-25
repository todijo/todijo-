import test from "node:test";
import assert from "node:assert/strict";
import { BUYER_ORDER_PAGE_SIZE, buyerOrderPageNumber, getBuyerOrder, listBuyerOrders, listBuyerOrdersPage } from "../lib/buyer-orders";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("buyer order listing scopes the Prisma query to the authenticated buyer", async () => {
  const records = [{ id: "order_owned", buyerId: "buyer_1" }, { id: "order_other", buyerId: "buyer_2" }];
  const db: any = {
    order: {
      findMany: async ({ where, orderBy }: any) => {
        assert.deepEqual(where, { buyerId: "buyer_1" });
        assert.deepEqual(orderBy, { createdAt: "desc" });
        return records.filter((order) => order.buyerId === where.buyerId);
      },
    },
  };

  const orders = await listBuyerOrders(db, "buyer_1");
  assert.deepEqual(orders.map((order) => order.id), ["order_owned"]);
});

test("buyer order pages are bounded, stable and buyer-scoped", async () => {
  const records = Array.from({ length: 45 }, (_, index) => ({ id: `order_${index}`, buyerId: "buyer_1" }));
  const db: any = { order: { findMany: async ({ where, orderBy, skip, take }: any) => {
    assert.deepEqual(where, { buyerId: "buyer_1" });
    assert.deepEqual(orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.equal(take, BUYER_ORDER_PAGE_SIZE + 1);
    return records.slice(skip, skip + take);
  } } };
  const first = await listBuyerOrdersPage(db, "buyer_1", "1");
  const second = await listBuyerOrdersPage(db, "buyer_1", "2");
  const third = await listBuyerOrdersPage(db, "buyer_1", "3");
  assert.deepEqual([first.orders.length, second.orders.length, third.orders.length], [20, 20, 5]);
  assert.deepEqual([first.hasMore, second.hasMore, third.hasMore], [true, true, false]);
  assert.equal(second.orders[0].id, "order_20");
  assert.equal(third.pageSize, 20);
});

test("buyer order page input is clamped and rejects non-integer values", () => {
  assert.equal(buyerOrderPageNumber("2"), 2);
  assert.equal(buyerOrderPageNumber("0"), 1);
  assert.equal(buyerOrderPageNumber("1.5"), 1);
  assert.equal(buyerOrderPageNumber("oops"), 1);
  assert.equal(buyerOrderPageNumber("999999"), 10_000);
});

test("buyer order details require both the order id and authenticated buyer id", async () => {
  const db: any = {
    order: {
      findFirst: async ({ where }: any) => {
        assert.deepEqual(where, { id: "order_other", buyerId: "buyer_1" });
        return null;
      },
    },
  };

  assert.equal(await getBuyerOrder(db, "buyer_1", "order_other"), null);
});

test("order reads retain nullable legacy snapshot fields", async () => {
  const db: any = { order: { findMany: async () => [{ id: "legacy", snapshotSource: null, items: [] }] } };
  const orders = await listBuyerOrders(db, "buyer_1");
  assert.equal(orders[0].snapshotSource, null);
});

test("buyer order pages prefer snapshot images and retain live-image fallbacks", () => {
  const list = readFileSync(join(process.cwd(), "app", "[locale]", "account", "orders", "page.tsx"), "utf8");
  const detail = readFileSync(join(process.cwd(), "app", "[locale]", "account", "orders", "[orderId]", "page.tsx"), "utf8");
  for (const source of [list, detail]) assert.match(source, /productImageUrlSnapshot \?\? item\.product\.images\[0\]/);
});

test("checkout success reads saved store and option snapshots", () => {
  const source = readFileSync(join(process.cwd(), "app", "checkout", "success", "page.tsx"), "utf8");
  assert.match(source, /storeNameSnapshot \?\? item\.product\.store\.name/);
  assert.match(source, /item\.selectedColor, item\.selectedSize/);
});
