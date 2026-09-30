import test from "node:test";
import assert from "node:assert/strict";
import { configuredSellerPlan, sellerPlanEntitlement, sellerPlans } from "../lib/seller-plans";
import { platformFeePercent } from "../lib/stripe";

test("canonical seller plans use approved cent-accurate monthly and annual prices", () => {
  const plans = Object.fromEntries(sellerPlans().map((plan) => [plan.id, plan]));
  assert.deepEqual(
    {
      basic: [plans.basic.monthlyAmountMinor, plans.basic.annualAmountMinor, plans.basic.productLimit, plans.basic.dropshipping],
      plus: [plans.plus.monthlyAmountMinor, plans.plus.annualAmountMinor, plans.plus.productLimit, plans.plus.dropshipping],
      pro: [plans.pro.monthlyAmountMinor, plans.pro.annualAmountMinor, plans.pro.productLimit, plans.pro.dropshipping],
    },
    { basic: [699, 6710, 10, false], plus: [1499, 14390, 50, false], pro: [2699, 25910, null, true] },
  );
  for (const plan of Object.values(plans)) {
    assert.equal(plan.annualAmountMinor, Math.round(plan.monthlyAmountMinor * 12 * 0.8));
  }
});

test("seller plan selection rejects forged plans, intervals, and unconfigured prices", () => {
  assert.equal(configuredSellerPlan("enterprise", "monthly"), null);
  assert.equal(configuredSellerPlan("pro", "weekly"), null);
  assert.equal(configuredSellerPlan("pro", "monthly"), null);
  assert.equal(sellerPlanEntitlement("enterprise"), null);
});

test("marketplace commission defaults to the approved six percent", () => {
  const previous = process.env.STRIPE_PLATFORM_FEE_PERCENT;
  delete process.env.STRIPE_PLATFORM_FEE_PERCENT;
  try { assert.equal(platformFeePercent(), 6); }
  finally {
    if (previous === undefined) delete process.env.STRIPE_PLATFORM_FEE_PERCENT;
    else process.env.STRIPE_PLATFORM_FEE_PERCENT = previous;
  }
});
