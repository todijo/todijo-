import assert from "node:assert/strict";
import test from "node:test";
import { listAdminOrderHistory, listSellerOrderHistory, normalizeOrderHistoryPage, normalizeOrderReferenceSearch } from "../lib/order-history";

function database(total = 0) {
  const findCalls: any[] = [];
  const countCalls: any[] = [];
  const db: any = {
    order: {
      findMany: async (input: any) => { findCalls.push(input); return []; },
      count: async (input: any) => { countCalls.push(input); return total; },
    },
  };
  return { db, findCalls, countCalls };
}

test("seller finds an owned order by full reference with database pagination", async () => {
  const { db, findCalls } = database(41);
  await listSellerOrderHistory(db, "seller_1", "store_1", " cmnr85vbi0001k501sbecuhr5 ", "2");
  assert.equal(findCalls[0].where.AND[0].OR[0].storeIdSnapshot, "store_1");
  assert.equal(findCalls[0].where.AND[1].id.contains, "cmnr85vbi0001k501sbecuhr5");
  assert.deepEqual({ skip: findCalls[0].skip, take: findCalls[0].take }, { skip: 20, take: 20 });
});

test("seller reference search accepts the displayed optional hash prefix without weakening ownership", async () => {
  const { db, findCalls } = database();
  await listSellerOrderHistory(db, "seller_1", "store_1", " #cms1n7dy20001p801f3igscyx ", "1");
  assert.equal(findCalls[0].where.AND[1].id.contains, "cms1n7dy20001p801f3igscyx");
  assert.equal(findCalls[0].where.AND[0].OR[0].storeIdSnapshot, "store_1");
  assert.equal(findCalls[0].where.AND[0].OR[1].items.every.product.store.ownerId, "seller_1");
});

test("seller includes a legacy order only when all items belong to its store", async () => {
  const { db, findCalls } = database();
  await listSellerOrderHistory(db, "seller_1", "store_1", "85vbi", "1");
  const ownership = findCalls[0].where.AND[0].OR;
  assert.equal(findCalls[0].where.AND[1].id.contains, "85vbi");
  assert.equal(ownership[0].storeIdSnapshot, "store_1");
  assert.equal(ownership[1].storeIdSnapshot, null);
  assert.equal(ownership[1].items.some.product.store.ownerId, "seller_1");
  assert.equal(ownership[1].items.every.product.store.ownerId, "seller_1");
});

test("seller excludes a legacy multi-store order", async () => {
  const { db, findCalls } = database();
  await listSellerOrderHistory(db, "seller_1", "store_1", "85vbi", "1");
  const legacyItems = findCalls[0].where.AND[0].OR[1].items;
  assert.deepEqual(legacyItems.every, { product: { store: { ownerId: "seller_1" } } });
});

test("admin can search marketplace-wide by reference", async () => {
  const { db, findCalls } = database();
  await listAdminOrderHistory(db, "cmnr85", "1");
  assert.deepEqual(findCalls[0].where, { id: { contains: "cmnr85", mode: "insensitive" } });
  assert.equal(findCalls[0].skip, 0);
});

test("blank and invalid search inputs are normalized safely", () => {
  assert.equal(normalizeOrderReferenceSearch("   "), "");
  assert.equal(normalizeOrderReferenceSearch({}), "");
  assert.equal(normalizeOrderReferenceSearch("x".repeat(101)).length, 100);
  assert.equal(normalizeOrderReferenceSearch("#cms1n7dy20001p801f3igscyx"), "cms1n7dy20001p801f3igscyx");
  assert.equal(normalizeOrderHistoryPage("invalid"), 1);
  assert.equal(normalizeOrderHistoryPage("-1"), 1);
  assert.equal(normalizeOrderHistoryPage("1.5"), 1);
});

test("zero results use the first page and first database offset", async () => {
  const { db, findCalls } = database(0);
  const result = await listAdminOrderHistory(db, "missing", "999999");
  assert.deepEqual(result.orders, []);
  assert.equal(result.total, 0);
  assert.equal(result.page, 1);
  assert.equal(findCalls[0].skip, 0);
});

test("out-of-range pages are clamped before database pagination", async () => {
  const { db, findCalls } = database(41);
  const result = await listSellerOrderHistory(db, "seller_1", "store_1", "85vbi", "999999");
  assert.equal(result.page, 3);
  assert.deepEqual({ skip: findCalls[0].skip, take: findCalls[0].take }, { skip: 40, take: 20 });
});
