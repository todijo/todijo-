import test from "node:test";
import assert from "node:assert/strict";
import { cartLineKey, normalizeCartOption } from "../lib/cart-line";

test("cart line identity separates variants and normalizes optional values", () => {
  assert.equal(normalizeCartOption("  red "), "red");
  assert.equal(normalizeCartOption("  "), null);
  assert.equal(cartLineKey("product", "red", "M"), cartLineKey("product", " red ", "M"));
  assert.notEqual(cartLineKey("product", "red", "M"), cartLineKey("product", "blue", "M"));
  assert.equal(cartLineKey("product"), JSON.stringify(["product", null, null]));
});
