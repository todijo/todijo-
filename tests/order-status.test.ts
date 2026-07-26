import assert from "node:assert/strict";
import test from "node:test";
import { fulfillmentStepFor, fulfillmentStepIndex } from "../lib/order-status";

test("maps existing database statuses without changing persisted values", () => {
  assert.equal(fulfillmentStepFor("PENDING"), null);
  assert.equal(fulfillmentStepFor("PAID"), "CONFIRMED");
  assert.equal(fulfillmentStepFor("PROCESSING"), "PREPARING");
  assert.equal(fulfillmentStepFor("SHIPPED"), "SHIPPED");
  assert.equal(fulfillmentStepFor("DELIVERED"), "DELIVERED");
  assert.equal(fulfillmentStepFor("CANCELLED"), null);
  assert.equal(fulfillmentStepIndex("DELIVERED"), 3);
});
