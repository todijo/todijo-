import assert from "node:assert/strict";
import test from "node:test";
import { sellerSupplierFulfillmentAllowsTransition } from "../lib/suppliers/seller-fulfillment-policy";

test("CJ seller preparation is allowed but shipment waits for authoritative supplier status", () => {
  assert.equal(sellerSupplierFulfillmentAllowsTransition("PAID", ["MANUAL_ACTION_REQUIRED"]), true);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("PROCESSING", ["MANUAL_ACTION_REQUIRED"]), false);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("PROCESSING", ["SHIPPED"]), true);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("PROCESSING", ["SHIPPED", "PENDING"]), false);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("SHIPPED", ["SHIPPED"]), false);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("SHIPPED", ["DELIVERED"]), true);
  assert.equal(sellerSupplierFulfillmentAllowsTransition("PROCESSING", []), true);
});
