import test from "node:test";
import assert from "node:assert/strict";
import { canPublish, effectiveSellerPlan, sellerProductQuota } from "../lib/seller-subscription";

test("publishing requires both an active seller and active or trialing subscription", () => {
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "ACTIVE" } }), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "TRIALING" } }), true);
  assert.equal(canPublish({ status: "PENDING", subscription: { status: "ACTIVE" } }), false);
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "PAST_DUE" } }), false);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null }), false);
});

test("admin-granted and admin-exempt stores can publish without a Stripe subscription", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_EXEMPT", startsAt: now, endsAt: null }] }, now), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", startsAt: new Date("2025-01-01T00:00:00Z"), endsAt: now }] }, now), false);
});

test("normal seller still requires a valid subscription or explicit grant", () => {
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [] }), false);
});

test("product quotas fail closed and preserve the all-products count semantics", () => {
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 9 }), { productLimit: 10, blocked: false });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 10 }), { productLimit: 10, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "plus", productCount: 50 }), { productLimit: 50, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "pro", productCount: 500 }), { productLimit: null, blocked: false });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "forged", productCount: 0 }), { productLimit: null, blocked: true });
});

test("authoritative active Stripe plan wins and plan-level Admin grants work without Stripe", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: { status: "ACTIVE", plan: "plus" }, accessGrants: [{ source: "ADMIN_GRANTED", plan: "pro", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), "plus");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", plan: "basic", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), "basic");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", plan: "forged", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), null);
});
