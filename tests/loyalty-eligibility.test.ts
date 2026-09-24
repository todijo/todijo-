import assert from "node:assert/strict";
import test from "node:test";
import { productLoyaltyEligibility } from "../lib/loyalty-eligibility";

test("new local listings default out and explicit opt-in persists on edits", () => {
  assert.equal(productLoyaltyEligibility(undefined, false), false);
  assert.equal(productLoyaltyEligibility(true, false), true);
  assert.equal(productLoyaltyEligibility(undefined, false, true), true);
  assert.equal(productLoyaltyEligibility(false, false, true), false);
});

test("supplier-linked/CJ products fail closed even with tampered opt-in", () => {
  assert.equal(productLoyaltyEligibility(undefined, true, true), false);
  assert.equal(productLoyaltyEligibility(false, true), false);
  assert.throws(() => productLoyaltyEligibility(true, true), { code: "DROPSHIPPING_LOYALTY_FORBIDDEN" });
  assert.throws(() => productLoyaltyEligibility("true", false), { code: "INVALID_PRODUCT_LOYALTY" });
});
