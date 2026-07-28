import test from "node:test";
import assert from "node:assert/strict";
import { comparisonPercent, sellerAnalytics, sellerPeriodMetrics } from "../lib/seller-dashboard";
import { sellerOrderHistoryWhere } from "../lib/order-history";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const now = new Date("2026-07-22T12:00:00Z");
const order = (daysAgo: number, amount: number, status = "PAID") => ({ status, buyerId: `buyer_${daysAgo}`, createdAt: new Date(now.getTime() - daysAgo * 86400000), paidAt: amount ? new Date() : null, stripePaymentIntentId: amount ? "pi" : null, sellerAmount: amount, items: [{ quantity: 2, product: { id: "p1", name: "Product" } }] });

test("seller period metrics use real current and previous 30 day windows", () => {
  const metrics = sellerPeriodMetrics([order(2, 1200), order(40, 800)], now);
  assert.deepEqual(metrics.current, { orders: 1, revenue: 12, customers: 1 });
  assert.deepEqual(metrics.previous, { orders: 1, revenue: 8, customers: 1 });
  assert.equal(comparisonPercent(metrics.current.revenue, metrics.previous.revenue), 50);
  assert.equal(comparisonPercent(10, 0), null);
});

test("seller analytics aggregate paid product quantities without fake data", () => {
  const analytics = sellerAnalytics([order(2, 1200), order(1, 0, "PENDING")], "en", now);
  assert.equal(analytics.trends.reduce((sum, day) => sum + day.orders, 0), 2);
  assert.deepEqual(analytics.products, [{ name: "Product", quantity: 2 }]);
  assert.equal(analytics.statuses.find((item) => item.status === "PENDING")?.value, 1);
});

test("seller analytics prefer immutable product snapshots", () => {
  const snapshotOrder: any = { ...order(2, 1200), items: [{ quantity: 1, productNameSnapshot: "Purchased name", product: { id: "p1", name: "Current name" } }] };
  assert.deepEqual(sellerAnalytics([snapshotOrder], "en", now).products, [{ name: "Purchased name", quantity: 1 }]);
});

test("seller recent orders prefer snapshots and retain relation fallbacks", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  assert.match(source, /productImageUrlSnapshot \?\? item\?\.product\.images\[0\]/);
  assert.match(source, /productNameSnapshot \?\? item\?\.product\.name/);
  assert.match(source, /recipientName \?\? order\.buyerNameSnapshot \?\?/);
});

test("seller dashboard reuses the strict order ownership filter and retains five recent orders", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  assert.match(source, /where: sellerOrderHistoryWhere\(session\.userId, user\.store\.id, ""\)/);
  assert.match(source, /sellerOrders\.slice\(0, 5\)/);
  const branches: any[] = (sellerOrderHistoryWhere("seller_1", "store_1", "") as any).AND[0].OR;
  assert.deepEqual(branches[0], { storeIdSnapshot: "store_1" });
  assert.equal(branches[1].storeIdSnapshot, null);
  assert.equal(branches[1].items.some.product.store.ownerId, "seller_1");
  assert.equal(branches[1].items.every.product.store.ownerId, "seller_1");
});

test("seller dashboard scope excludes every legacy multi-store order before rendering", () => {
  const branches: any[] = (sellerOrderHistoryWhere("seller_1", "store_1", "") as any).AND[0].OR;
  const legacy = branches[1];
  const allows = (storeIdSnapshot: string | null, itemOwnerIds: string[]) =>
    storeIdSnapshot === branches[0].storeIdSnapshot || (
      storeIdSnapshot === legacy.storeIdSnapshot
      && itemOwnerIds.some((ownerId) => ownerId === legacy.items.some.product.store.ownerId)
      && itemOwnerIds.every((ownerId) => ownerId === legacy.items.every.product.store.ownerId)
    );

  assert.equal(allows(null, ["seller_1", "seller_1"]), true);
  assert.equal(allows(null, ["seller_1", "foreign_seller"]), false);
  assert.equal(allows(null, ["foreign_seller", "seller_1"]), false);
  assert.equal(allows("store_1", ["foreign_seller"]), true);
  assert.equal(allows("store_2", ["seller_1"]), false);
});
