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
