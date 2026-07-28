import test from "node:test";
import assert from "node:assert/strict";
import { getBuyerOrder, listBuyerOrders } from "../lib/buyer-orders";
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
