import test from "node:test";
import assert from "node:assert/strict";
import { composeLoyaltyPayment } from "../lib/loyalty-payment-composition";

test("two sellers, excluded CJ, and shipping reconcile without cross-store credit", () => {
  const quote = composeLoyaltyPayment({
    lines: [
      { lineKey: "a-local", storeId: "A", unitAmountMinor: 5_000,
        quantity: 1, eligible: true, dropshipping: false },
      { lineKey: "a-cj", storeId: "A", unitAmountMinor: 2_000,
        quantity: 1, eligible: false, dropshipping: true },
      { lineKey: "b-local", storeId: "B", unitAmountMinor: 3_000,
        quantity: 1, eligible: true, dropshipping: false },
    ], shippingByStore: new Map([["A", 500], ["B", 300]]),
    requestedByStore: new Map([["A", 1_000], ["B", 0]]),
    reserveByStore: new Map([["A", 80], ["B", 60]]),
    commissionPercent: 6,
  });
  assert.equal(quote.merchandiseMinor, 10_000);
  assert.equal(quote.shippingMinor, 800);
  assert.equal(quote.eligibleMinor, 8_000);
  assert.equal(quote.excludedMinor, 2_000);
  assert.equal(quote.redeemedMinor, 1_000);
  assert.equal(quote.newCashPaidMinor, 9_800);
  assert.equal(quote.commissionBaseMinor, 9_000);
  assert.equal(quote.platformCommissionMinor, 540);
  assert.equal(quote.sellerPayableMinor, 10_120);
  assert.equal(quote.lines.find(line => line.lineKey === "a-cj")?.redeemedMinor, 0);
  assert.equal(quote.stores.find(store => store.storeId === "B")?.redeemedMinor, 0);
});

test("fully funded merchandise with free shipping has zero new cash and no new commission", () => {
  const quote = composeLoyaltyPayment({
    lines: [{ lineKey: "local", storeId: "A", unitAmountMinor: 1_000,
      quantity: 1, eligible: true, dropshipping: false }],
    shippingByStore: new Map([["A", 0]]),
    requestedByStore: new Map([["A", 1_000]]),
    commissionPercent: 6,
  });
  assert.equal(quote.newCashPaidMinor, 0);
  assert.equal(quote.redeemedMinor, 1_000);
  assert.equal(quote.commissionBaseMinor, 0);
  assert.equal(quote.platformCommissionMinor, 0);
  assert.equal(quote.sellerPayableMinor, 1_000);
});

test("redemption cannot be silently assigned to another store or shipping", () => {
  const line = { lineKey: "a", storeId: "A", unitAmountMinor: 1_000,
    quantity: 1, eligible: true, dropshipping: false };
  const base = { lines: [line], shippingByStore: new Map([["A", 500]]),
    commissionPercent: 6 };
  assert.throws(() => composeLoyaltyPayment({ ...base,
    requestedByStore: new Map([["B", 100]]) }), RangeError);
  assert.throws(() => composeLoyaltyPayment({ ...base,
    requestedByStore: new Map([["A", 1_500]]) }), RangeError);
  assert.throws(() => composeLoyaltyPayment({ ...base,
    shippingByStore: new Map([["B", 500]]),
    requestedByStore: new Map() }), RangeError);
});
