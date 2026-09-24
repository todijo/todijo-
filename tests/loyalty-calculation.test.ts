import assert from "node:assert/strict";
import test from "node:test";
import { allocateEarnedMinor, calculateLoyaltyQuote, loyaltyReserveReversalMinor, type LoyaltyLine } from "../lib/loyalty-calculation";

const line = (overrides: Partial<LoyaltyLine> = {}): LoyaltyLine => ({
  lineKey: "line-1", storeId: "store-a", merchandiseMinor: 10_000,
  discountMinor: 0, eligible: true, dropshipping: false, ...overrides,
});
const quote = (lines: LoyaltyLine[], options: {
  earningEnabled?: boolean; rateBps?: number;
  available?: [string, number][]; requested?: [string, number][];
  earningByStore?: [string, boolean][];
} = {}) => calculateLoyaltyQuote({
  earningEnabled: options.earningEnabled ?? true, rateBps: options.rateBps ?? 200,
  earningEnabledByStore: new Map(options.earningByStore ?? [["store-a", true], ["store-b", true]]),
  lines, availableByStore: new Map(options.available ?? []),
  requestedByStore: new Map(options.requested ?? []),
});

test("2% of €100 eligible merchandise earns €2, never shipping", () => {
  assert.equal(quote([line()]).totalEarnedMinor, 200);
});
test("future rate changes affect only a new quote", () => {
  const old = quote([line()]);
  assert.equal(quote([line()], { rateBps: 250 }).totalEarnedMinor, 250);
  assert.equal(old.totalEarnedMinor, 200);
});
test("seller opt-out stops earning but preserves funded redemption; CJ cannot redeem", () => {
  const optedOut = quote([line()], { earningByStore: [["store-a", false]], available: [["store-a", 500]], requested: [["store-a", 500]] });
  assert.equal(optedOut.totalEarnedMinor, 0);
  assert.equal(optedOut.totalRedeemedMinor, 500);
  assert.equal(quote([line({ eligible: false })]).totalEarnedMinor, 0);
  assert.equal(quote([line({ dropshipping: true })], { available: [["store-a", 500]], requested: [["store-a", 500]] }).totalRedeemedMinor, 0);
});
test("discounts reduce earning base", () => {
  assert.equal(quote([line({ discountMinor: 2_500 })]).totalEarnedMinor, 150);
});
test("mixed sellers and eligible/CJ lines isolate reserves", () => {
  const result = quote([
    line(),
    line({ lineKey: "line-2", storeId: "store-b", merchandiseMinor: 5_000 }),
    line({ lineKey: "line-3", merchandiseMinor: 2_000, eligible: false }),
    line({ lineKey: "line-4", storeId: "store-b", merchandiseMinor: 3_000, dropshipping: true }),
  ], { available: [["store-a", 1_000], ["store-b", 200]], requested: [["store-a", 1_000], ["store-b", 500]] });
  assert.deepEqual(result.stores, [
    { storeId: "store-a", eligibleNetMinor: 10_000, redeemedMinor: 1_000, newlyPaidEligibleMinor: 9_000, earnedMinor: 180, commissionableMerchandiseMinor: 11_000 },
    { storeId: "store-b", eligibleNetMinor: 5_000, redeemedMinor: 200, newlyPaidEligibleMinor: 4_800, earnedMinor: 96, commissionableMerchandiseMinor: 7_800 },
  ]);
});
test("full eligible redemption never pays shipping or earns credit again", () => {
  const result = quote([line({ merchandiseMinor: 5_000 })], { available: [["store-a", 5_000]], requested: [["store-a", 5_000]] });
  assert.equal(result.stores[0].newlyPaidEligibleMinor, 0);
  assert.equal(result.stores[0].earnedMinor, 0);
  assert.equal(result.stores[0].commissionableMerchandiseMinor, 0);
});
test("bad identities, discounts and money inputs fail closed", () => {
  assert.throws(() => quote([line(), line()]));
  assert.throws(() => quote([line({ discountMinor: 10_001 })]));
  assert.throws(() => quote([line({ merchandiseMinor: Number.NaN })]));
  assert.throws(() => quote([line()], { rateBps: 10_001 }));
});
test("line earning allocation sums to one rounded store reserve", () => {
  const allocation = allocateEarnedMinor([
    { lineKey: "b", eligiblePaidMinor: 33 },
    { lineKey: "a", eligiblePaidMinor: 33 },
    { lineKey: "c", eligiblePaidMinor: 34 },
  ], 200);
  assert.equal([...allocation.values()].reduce((sum, value) => sum + value, 0), 2);
  assert.equal(allocation.get("c"), 1);
});
test("partial and full refund release only the matching seller-funded reserve", () => {
  const first = loyaltyReserveReversalMinor({ grantMinor: 200,
    originalQuantity: 2, cumulativeRefundedQuantity: 1, previouslyReversedMinor: 0 });
  const second = loyaltyReserveReversalMinor({ grantMinor: 200,
    originalQuantity: 2, cumulativeRefundedQuantity: 2, previouslyReversedMinor: first });
  assert.equal(first, 100);
  assert.equal(second, 100);
  assert.equal(10_000 - 1_000 - 200, 8_800); // seller payable before refund
  assert.equal(5_000 - 500 - first, 4_400); // first seller recovery
  assert.equal(loyaltyReserveReversalMinor({ grantMinor: 0,
    originalQuantity: 1, cumulativeRefundedQuantity: 1, previouslyReversedMinor: 0 }), 0);
});
test("refunding an ineligible line in the same seller group does not release another line's reserve", () => {
  const eligibleGrant = 200;
  const ineligibleGrant = 0;
  assert.equal(loyaltyReserveReversalMinor({ grantMinor: ineligibleGrant,
    originalQuantity: 1, cumulativeRefundedQuantity: 1, previouslyReversedMinor: 0 }), 0);
  assert.equal(loyaltyReserveReversalMinor({ grantMinor: eligibleGrant,
    originalQuantity: 1, cumulativeRefundedQuantity: 0, previouslyReversedMinor: 0 }), 0);
});
