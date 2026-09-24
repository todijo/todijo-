import assert from "node:assert/strict";
import test from "node:test";
import { allocateLoyaltyRedemption } from "../lib/loyalty-redemption-lines";

test("redemption splits only eligible same-store units and never alters shipping", () => {
  const quote = allocateLoyaltyRedemption({ lines: [
    { lineKey: "a", storeId: "store-a", unitAmountMinor: 501, quantity: 2,
      eligible: true, dropshipping: false },
    { lineKey: "b", storeId: "store-b", unitAmountMinor: 1000, quantity: 1,
      eligible: true, dropshipping: false },
    { lineKey: "cj", storeId: "store-a", unitAmountMinor: 1200, quantity: 1,
      eligible: false, dropshipping: true },
  ], requestedByStore: new Map([["store-a", 301], ["store-b", 500]]) });
  assert.equal(quote.redeemedMinor, 801);
  assert.equal(quote.lines[0].newlyPaidMinor, 701);
  assert.deepEqual(quote.lines[0].paymentUnits, [
    { unitAmountMinor: 350, quantity: 1 }, { unitAmountMinor: 351, quantity: 1 },
  ]);
  assert.equal(quote.lines[1].redeemedMinor, 500);
  assert.equal(quote.lines[2].redeemedMinor, 0);
  assert.equal(quote.lines.flatMap(line => line.paymentUnits).reduce((sum, unit) =>
    sum + unit.unitAmountMinor * unit.quantity, 0), quote.newlyPaidMerchandiseMinor);
});

test("full eligible redemption is exact while cross-store/CJ overreach fails closed", () => {
  const line = { lineKey: "a", storeId: "store-a", unitAmountMinor: 100, quantity: 2,
    eligible: true, dropshipping: false };
  const full = allocateLoyaltyRedemption({ lines: [line], requestedByStore: new Map([["store-a", 200]]) });
  assert.equal(full.newlyPaidMerchandiseMinor, 0);
  assert.deepEqual(full.lines[0].paymentUnits, [{ unitAmountMinor: 0, quantity: 2 }]);
  assert.throws(() => allocateLoyaltyRedemption({ lines: [line],
    requestedByStore: new Map([["store-b", 1]]) }));
  assert.throws(() => allocateLoyaltyRedemption({ lines: [{ ...line, dropshipping: true }],
    requestedByStore: new Map([["store-a", 1]]) }));
  assert.throws(() => allocateLoyaltyRedemption({ lines: [line],
    requestedByStore: new Map([["store-a", 201]]) }));
});
