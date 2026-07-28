import test from "node:test";
import assert from "node:assert/strict";
import { comparisonPercent, sellerAnalytics, sellerPeriodMetrics } from "../lib/seller-dashboard";
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
