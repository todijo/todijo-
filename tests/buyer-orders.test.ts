import test from "node:test";
import assert from "node:assert/strict";
import { getBuyerOrder, listBuyerOrders } from "../lib/buyer-orders";

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
