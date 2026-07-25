import test from "node:test";
import assert from "node:assert/strict";
import { canPublish } from "../lib/seller-subscription";

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
