import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSellerCommercialAccess } from "../lib/seller-commercial-access";
import { adminAccessStatus } from "../lib/admin-access-status";

const now = new Date("2026-10-04T00:00:00Z"), end = new Date("2027-10-04T00:00:00Z");
const connect = { sellerSuspendedAt: null, stripeAccountId: null, stripeOnboardingComplete: false, stripeChargesEnabled: false, stripePayoutsEnabled: false };
function snapshot(role = "SELLER", plan: string | null = null, grant: string | null = null, lifecycle = "ACTIVE", expiry = end) {
  return adminAccessStatus({ lifecycle, onboarding: "PENDING_REVIEW", billingStatus: plan ? "ACTIVE" : null, connect,
    access: resolveSellerCommercialAccess({ role, subscription: plan ? { status: "ACTIVE", plan, currentPeriodEnd: expiry } : null,
      accessGrants: grant ? [{ source: "ADMIN_GRANTED", plan: grant, startsAt: now, endsAt: expiry }] : [] }, now) });
}
for (const plan of ["basic", "plus", "pro"]) {
  test(`paid ${plan} remains authoritative over grant`, () => {
    const state = snapshot("SELLER", plan, "pro");
    assert.equal(state.source, "PAID_SUBSCRIPTION"); assert.equal(state.plan, plan.toUpperCase()); assert.equal(state.active, true); assert.equal(state.expiresAt, end.toISOString());
  });
  test(`Admin ${plan} grant is independent of PENDING lifecycle`, () => {
    const state = snapshot("SELLER", null, plan, "PENDING");
    assert.equal(state.source, "ADMIN_GRANT"); assert.equal(state.plan, plan.toUpperCase()); assert.equal(state.lifecycle, "PENDING"); assert.equal(state.billingStatus, null); assert.equal(state.connectReadiness, "NOT_STARTED");
  });
}
test("ACTIVE lifecycle does not create commercial access", () => {
  const state = snapshot(); assert.equal(state.lifecycle, "ACTIVE"); assert.equal(state.source, "NONE"); assert.equal(state.active, false); assert.equal(state.plan, null); assert.equal(state.expiresAt, null);
});
test("expired grant and stale ACTIVE subscription have no tier or expiration", () => {
  for (const state of [snapshot("SELLER", null, "pro", "ACTIVE", now), snapshot("SELLER", "pro", null, "ACTIVE", now)]) {
    assert.equal(state.source, "NONE"); assert.equal(state.plan, null); assert.equal(state.expiresAt, null);
  }
});
test("Admin exemption is active and permanently tierless even with paid or grant records", () => {
  const state = snapshot("ADMIN", "basic", "pro"); assert.equal(state.source, "ADMIN_EXEMPT"); assert.equal(state.plan, null); assert.equal(state.expiresAt, null); assert.equal(state.active, true);
});
test("invalid paid tier does not hide valid grant or leave no-access expiry", () => {
  assert.equal(snapshot("SELLER", "forged", "plus").source, "ADMIN_GRANT");
  assert.equal(snapshot("SELLER", "forged").expiresAt, null);
});
test("future, forged, and non-Admin exemption grants cannot create access", () => {
  for (const grant of [
    { source: "ADMIN_GRANTED", plan: "pro", startsAt: end, endsAt: new Date("2028-10-04") },
    { source: "ADMIN_GRANTED", plan: "forged", startsAt: now, endsAt: end },
    { source: "ADMIN_EXEMPT", plan: null, startsAt: now, endsAt: null },
  ]) {
    const access = resolveSellerCommercialAccess({ role: "SELLER", subscription: null, accessGrants: [grant] }, now);
    assert.equal(access.active, false); assert.equal(access.plan, null); assert.equal(access.expiresAt, null);
  }
});
test("billing PAST_DUE alone is not paid entitlement", () => {
  const access = resolveSellerCommercialAccess({ role: "SELLER", subscription: { status: "PAST_DUE", plan: "pro", currentPeriodEnd: end }, accessGrants: [] }, now);
  assert.equal(access.source, "NONE"); assert.equal(access.expiresAt, null);
});
test("identity resolution failure is not presented as a proven lack of access", () => {
  const state = adminAccessStatus({ lifecycle: "ACTIVE", onboarding: "IN_PROGRESS", access: resolveSellerCommercialAccess({ role: "SELLER", subscription: null, accessGrants: [] }, now), billingStatus: null, connect, resolutionError: "OWNER_STATE_CHANGED" });
  assert.equal(state.resolutionError, "OWNER_STATE_CHANGED");
  assert.ok(readFileSync("components/AdminAccessStatus.tsx", "utf8").includes("if (state.resolutionError)"));
});
test("Connect readiness and billing do not change entitlement or lifecycle", () => {
  const state = adminAccessStatus({ lifecycle: "PENDING", onboarding: "IN_PROGRESS", access: resolveSellerCommercialAccess({ role: "SELLER", subscription: null, accessGrants: [] }, now), billingStatus: "PAST_DUE", connect: { ...connect, stripeAccountId: "acct_mock", stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true } });
  assert.equal(state.connectReadiness, "READY"); assert.equal(state.source, "NONE"); assert.equal(state.lifecycle, "PENDING"); assert.equal(state.billingStatus, "PAST_DUE");
});
test("Admin views share commercial summary and separate status cells", () => {
  for (const file of ["app/adm-barewbar-182203/page.tsx", "app/adm-barewbar-182203/sellers/page.tsx", "app/adm-barewbar-182203/seller-review/page.tsx"]) {
    const source = readFileSync(file, "utf8"); assert.ok(source.includes("readManagedCommercialSummary")); assert.ok(source.includes("adminAccessStatus")); assert.ok(!source.includes("activeAccessSource"));
  }
  const cells = readFileSync("components/AdminAccessStatus.tsx", "utf8");
  for (const field of ["lifecycle", "onboarding", "source", "active", "plan", "expiresAt", "billingStatus", "connectReadiness"]) assert.ok(cells.includes(`state.${field}`));
});
test("paid plan remains derived from authoritative Price mapping; Team uses resolved capabilities", () => {
  const payments = readFileSync("lib/payments.ts", "utf8"); assert.ok(payments.includes("configuredSellerPlanForPriceId(priceId)")); assert.ok(payments.includes("plan: configuredPlan.plan"));
  const team = readFileSync("lib/seller-team.ts", "utf8"); assert.ok(team.includes("sellerBusinessCapabilityTier"));
});
