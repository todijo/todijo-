import assert from "node:assert/strict";
import test from "node:test";
import { fulfillmentStepFor, fulfillmentStepIndex, sellerFulfillmentActionFor } from "../lib/order-status";

test("maps existing database statuses without changing persisted values", () => {
  assert.equal(fulfillmentStepFor("PENDING"), null);
  assert.equal(fulfillmentStepFor("PAID"), "CONFIRMED");
  assert.equal(fulfillmentStepFor("PROCESSING"), "PREPARING");
  assert.equal(fulfillmentStepFor("SHIPPED"), "SHIPPED");
  assert.equal(fulfillmentStepFor("DELIVERED"), "DELIVERED");
  assert.equal(fulfillmentStepFor("CANCELLED"), null);
  assert.equal(fulfillmentStepIndex("DELIVERED"), 3);
  assert.equal(sellerFulfillmentActionFor("PAID"), "PAID");
  assert.equal(sellerFulfillmentActionFor("PROCESSING"), "PROCESSING");
  assert.equal(sellerFulfillmentActionFor("SHIPPED"), "SHIPPED");
  assert.equal(sellerFulfillmentActionFor("DELIVERED"), null);
});
