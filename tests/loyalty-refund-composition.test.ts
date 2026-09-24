import test from "node:test";
import assert from "node:assert/strict";
import { loyaltyRefundComposition } from "../lib/loyalty-refund-composition";

test("full refund of €50 paid €40 cash and €10 credit returns only €40 through Stripe", () => {
  assert.deepEqual(loyaltyRefundComposition({ quantity: 1,
    unitGrossMinor: 5_000, redeemedMinor: 1_000,
    previouslyRefundedQuantity: 0, newlyRefundedQuantity: 1 }), {
    grossRefundMinor: 5_000, cashRefundMinor: 4_000,
    loyaltyRestoredMinor: 1_000, cumulativeLoyaltyRestoredMinor: 1_000,
  });
});

test("partial refunds preserve exact line attribution and reconcile the last unit", () => {
  const first = loyaltyRefundComposition({ quantity: 3,
    unitGrossMinor: 1_000, redeemedMinor: 1_000,
    previouslyRefundedQuantity: 0, newlyRefundedQuantity: 1 });
  const second = loyaltyRefundComposition({ quantity: 3,
    unitGrossMinor: 1_000, redeemedMinor: 1_000,
    previouslyRefundedQuantity: 1, newlyRefundedQuantity: 1 });
  const last = loyaltyRefundComposition({ quantity: 3,
    unitGrossMinor: 1_000, redeemedMinor: 1_000,
    previouslyRefundedQuantity: 2, newlyRefundedQuantity: 1 });
  assert.deepEqual([first.loyaltyRestoredMinor, second.loyaltyRestoredMinor,
    last.loyaltyRestoredMinor], [333, 333, 334]);
  assert.equal(first.cashRefundMinor + second.cashRefundMinor + last.cashRefundMinor, 2_000);
});

test("zero-cash redemption never produces a provider refund", () => {
  const refund = loyaltyRefundComposition({ quantity: 1,
    unitGrossMinor: 1_000, redeemedMinor: 1_000,
    previouslyRefundedQuantity: 0, newlyRefundedQuantity: 1 });
  assert.equal(refund.cashRefundMinor, 0);
  assert.equal(refund.loyaltyRestoredMinor, 1_000);
});
