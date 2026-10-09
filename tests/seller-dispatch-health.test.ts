import test from "node:test";
import assert from "node:assert/strict";
import { loadSellerDispatchHealth, sellerDispatchOutcome, sellerHealthWindow, SELLER_DISPATCH_DEADLINE_MS } from "../lib/seller-dispatch-health";

const paidAt = new Date("2026-04-01T10:00:00.000Z");
const base = { kind: "MARKETPLACE", orderStatus: "PROCESSING", paidAt, shippedAt: null, shipmentVerifiedAt: null, supplierFulfilled: false } as const;

test("seller dispatch deadline is elapsed UTC time from authoritative paidAt", () => {
  const before = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS - 1);
  const exact = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS);
  const after = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS + 1);
  assert.equal(sellerDispatchOutcome(base, before), "ON_TIME");
  assert.equal(sellerDispatchOutcome(base, exact), "LATE");
  assert.equal(sellerDispatchOutcome(base, after), "LATE");
  assert.equal(sellerDispatchOutcome({ ...base, shipmentVerifiedAt: exact }, exact), "ON_TIME");
  assert.equal(sellerDispatchOutcome({ ...base, shipmentVerifiedAt: after }, after), "LATE");
});
test("dispatch requires the existing verified shipment timestamp, not tracking or a shipping state alone", () => {
  const now = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS + 1);
  assert.equal(sellerDispatchOutcome({ ...base, orderStatus: "SHIPPED", shippedAt: now }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, orderStatus: "DELIVERED" }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, shipmentVerifiedAt: new Date(paidAt.getTime() - 1) }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, shipmentVerifiedAt: new Date(now.getTime() + 1) }, now), "UNKNOWN");
});

test("missing/future payment timestamps and persisted hold/unknown states never become a fabricated late result", () => {
  const now = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS + 1);
  assert.equal(sellerDispatchOutcome({ ...base, paidAt: null }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, paidAt: new Date(now.getTime() + 1) }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, orderStatus: "HELD" }, now), "UNKNOWN");
  assert.equal(sellerDispatchOutcome({ ...base, orderStatus: "REFUNDED" }, now), "UNKNOWN");
});

test("cancelled, CJ, and supplier-fulfilled orders are excluded from ordinary seller dispatch health", () => {
  const now = new Date(paidAt.getTime() + SELLER_DISPATCH_DEADLINE_MS + 1);
  assert.equal(sellerDispatchOutcome({ ...base, orderStatus: "CANCELLED" }, now), "EXCLUDED");
  assert.equal(sellerDispatchOutcome({ ...base, kind: "CJ_PLATFORM" }, now), "EXCLUDED");
  assert.equal(sellerDispatchOutcome({ ...base, supplierFulfilled: true }, now), "EXCLUDED");
});

test("seller health window is a rolling, timezone-independent 30 elapsed days", () => {
  const now = new Date("2026-10-09T15:30:00.000Z");
  const window = sellerHealthWindow(now);
  assert.equal(window.end.toISOString(), "2026-10-09T15:30:00.000Z");
  assert.equal(window.start.toISOString(), "2026-09-09T15:30:00.000Z");
  assert.equal(sellerDispatchOutcome({ ...base, paidAt: new Date("2026-04-01T12:00:00+02:00") }, new Date("2026-04-03T09:59:59.999Z")), "ON_TIME");
});

test("health query is store-scoped, bounded, read-only, supplier-aware, and counts persisted cash refunds", async () => {
  const calls: any[] = [];
  const db = { orderGroup: { findMany: async (args: any) => { calls.push({ method: "findMany", ...args }); return []; }, groupBy: async (args: any) => { calls.push({ method: "groupBy", ...args }); return [{ orderId: "order-1" }, { orderId: "order-2" }, { orderId: "order-3" }]; } } } as any;
  const now = new Date("2026-10-09T12:00:00.000Z");
  const result = await loadSellerDispatchHealth(db, "store-owned", now);
  assert.equal(calls.length, 2);
  assert.equal(result.ordersWithCashRefunds, 3);
  assert.equal(calls[0].where.storeId, "store-owned");
  assert.equal(calls[0].where.kind, "MARKETPLACE");
  assert.equal(calls[0].method, "findMany");
  assert.equal(calls[0].take, 500);
  assert.equal(calls[0].where.OR[0].order.paidAt.gte.toISOString(), "2026-09-09T12:00:00.000Z");
  assert.equal(calls[0].select.items.select.supplierFulfillmentItem.select.id, true);
  assert.equal(calls[1].where.storeId, "store-owned");
  assert.equal(calls[1].method, "groupBy");
  assert.deepEqual(calls[1].by, ["orderId"]);
  assert.equal(calls[1].where.OR[0].refundedCashMerchandiseMinor.gt, 0);
  assert.equal(calls[1].where.OR[1].refundedShippingMinor.gt, 0);
  assert.deepEqual(Object.keys(calls[0]).filter((key) => /update|delete|create/i.test(key)), []);
});
