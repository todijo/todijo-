import test from "node:test";
import assert from "node:assert/strict";
import { sellerLoyaltySettlement } from "../lib/loyalty-settlement";

test("partial redemption charges commission only on new merchandise payment", () => {
  assert.deepEqual(sellerLoyaltySettlement({ merchandiseMinor: 5_000,
    shippingMinor: 500, redeemedMinor: 1_000, newReserveMinor: 80,
    commissionPercent: 10 }), {
    commissionableMinor: 4_000, commissionMinor: 400,
    newCashPaidMinor: 4_500, sellerPayableMinor: 5_020,
  });
});

test("full eligible redemption preserves seller proceeds from funded reserve without double commission", () => {
  assert.deepEqual(sellerLoyaltySettlement({ merchandiseMinor: 5_000,
    shippingMinor: 0, redeemedMinor: 5_000, newReserveMinor: 0,
    commissionPercent: 10 }), {
    commissionableMinor: 0, commissionMinor: 0,
    newCashPaidMinor: 0, sellerPayableMinor: 5_000,
  });
});

test("mixed eligible and excluded value cannot overredeem or reserve more than newly paid merchandise", () => {
  const mixed = sellerLoyaltySettlement({ merchandiseMinor: 7_000,
    shippingMinor: 300, redeemedMinor: 1_000, newReserveMinor: 100,
    commissionPercent: 10 });
  assert.equal(mixed.commissionMinor, 600);
  assert.equal(mixed.newCashPaidMinor, 6_300);
  assert.equal(mixed.sellerPayableMinor, 6_600);
  assert.throws(() => sellerLoyaltySettlement({ merchandiseMinor: 7_000,
    shippingMinor: 300, redeemedMinor: 7_001, newReserveMinor: 0,
    commissionPercent: 10 }), RangeError);
  assert.throws(() => sellerLoyaltySettlement({ merchandiseMinor: 7_000,
    shippingMinor: 300, redeemedMinor: 7_000, newReserveMinor: 1,
    commissionPercent: 10 }), RangeError);
});
