import assert from "node:assert/strict";
import test from "node:test";
import { loadSellerDashboardAggregate } from "../lib/seller-dashboard-aggregate";

function database(rows: Array<unknown[]>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    db: { $queryRaw: async (query: { sql: string; values: unknown[] }) => { calls.push(query); return rows[calls.length - 1] ?? []; } } as any,
  };
}

const summary = (currency: string, values: Partial<Record<string, bigint>> = {}) => ({
  currency, totalOrders: BigInt("0"), pendingOrders: BigInt("0"), customers: BigInt("0"), newCustomersToday: BigInt("0"),
  currentCustomers: BigInt("0"), previousCustomers: BigInt("0"), revenueMinor: BigInt("0"), todayRevenueMinor: BigInt("0"),
  currentRevenueMinor: BigInt("0"), previousRevenueMinor: BigInt("0"), currentOrders: BigInt("0"), previousOrders: BigInt("0"), ...values,
});

test("database-side dashboard aggregates keep currencies separate and return a fixed 30-day window", async () => {
  const f = database([
    [summary("EUR", { totalOrders: BigInt("1200"), pendingOrders: BigInt("4"), customers: BigInt("91"), newCustomersToday: BigInt("3"), revenueMinor: BigInt("125000"), todayRevenueMinor: BigInt("4500"), currentRevenueMinor: BigInt("25000"), previousRevenueMinor: BigInt("20000"), currentOrders: BigInt("120"), previousOrders: BigInt("110"), currentCustomers: BigInt("80"), previousCustomers: BigInt("76") }), summary("USD", { totalOrders: BigInt("300"), pendingOrders: BigInt("1"), customers: BigInt("91"), newCustomersToday: BigInt("3"), revenueMinor: BigInt("50000"), todayRevenueMinor: BigInt("1000"), currentRevenueMinor: BigInt("7000"), previousRevenueMinor: BigInt("4000"), currentOrders: BigInt("20"), previousOrders: BigInt("15"), currentCustomers: BigInt("80"), previousCustomers: BigInt("76") })],
    [{ status: "PAID", value: BigInt("1200") }, { status: "PENDING", value: BigInt("4") }],
    [{ day: new Date("2026-10-10T00:00:00Z"), currency: "EUR", orders: BigInt("2"), revenueMinor: BigInt("400") }, { day: new Date("2026-10-10T00:00:00Z"), currency: "USD", orders: BigInt("1"), revenueMinor: BigInt("100") }],
    [{ name: "Historic product snapshot", quantity: BigInt("450") }],
  ]);
  const result = await loadSellerDashboardAggregate(f.db, "authorized-store", new Date("2026-10-10T12:00:00Z"));
  assert.equal(result.totalOrders, 1500);
  assert.equal(result.pendingOrders, 5);
  assert.equal(result.customers, 91, "distinct buyers are not added once per currency");
  assert.equal(result.newCustomersToday, 3);
  assert.deepEqual(result.revenueByCurrency, [{ currency: "EUR", amountMinor: 125000 }, { currency: "USD", amountMinor: 50000 }]);
  assert.deepEqual(result.todayRevenueByCurrency, [{ currency: "EUR", amountMinor: 4500 }, { currency: "USD", amountMinor: 1000 }]);
  assert.equal(result.currentCustomers, 80);
  assert.equal(result.previousCustomers, 76);
  assert.equal(result.trends.length, 30);
  assert.deepEqual(result.trends.find((point) => point.date === "2026-10-10"), { date: "2026-10-10", orders: 3, revenueByCurrency: { EUR: 400, USD: 100 } });
  assert.equal(result.products[0].quantity, 450);
  assert.equal(f.calls.length, 4);
  for (const call of f.calls) assert.ok(call.values.includes("authorized-store"), "every aggregate query is store-scoped");
  assert.ok(f.calls.some((call) => call.sql.includes("SUM(")));
  assert.ok(f.calls.some((call) => call.sql.includes("COUNT(DISTINCT")));
  assert.ok(f.calls.every((call) => !call.sql.includes("stripePaymentIntentId")), "attempted payments are not counted as revenue");
  assert.ok(f.calls.some((call) => call.values.some((value) => value instanceof Date)), "database queries receive bounded date parameters");
});

test("zero-order dashboard aggregate has zero totals and still returns a stable trend series", async () => {
  const f = database([[], [], [], []]);
  const result = await loadSellerDashboardAggregate(f.db, "empty-store", new Date("2026-10-10T12:00:00Z"));
  assert.equal(result.totalOrders, 0);
  assert.equal(result.customers, 0);
  assert.deepEqual(result.revenueByCurrency, []);
  assert.equal(result.trends.length, 30);
  assert.ok(result.trends.every((point) => point.orders === 0));
});

test("large aggregate counts remain database-side and reject unsafe monetary integer overflow", async () => {
  const f = database([[summary("EUR", { totalOrders: BigInt("25000000"), revenueMinor: BigInt("250000000000") })], [], [], []]);
  const result = await loadSellerDashboardAggregate(f.db, "large-store", new Date("2026-10-10T12:00:00Z"));
  assert.equal(result.totalOrders, 25_000_000);
  assert.equal(result.revenueByCurrency[0].amountMinor, 250_000_000_000);
  const overflow = database([[summary("EUR", { revenueMinor: BigInt(Number.MAX_SAFE_INTEGER) + BigInt("1") })], [], [], []]);
  await assert.rejects(() => loadSellerDashboardAggregate(overflow.db, "large-store"), /safe integer bounds/);
});
