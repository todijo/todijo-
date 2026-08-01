import test from "node:test";
import assert from "node:assert/strict";
import { cartLineKey, normalizeCartOption, removePurchasedCartLines } from "../lib/cart-line";

test("cart line identity separates variants and normalizes optional values", () => {
  assert.equal(normalizeCartOption("  red "), "red");
  assert.equal(normalizeCartOption("  "), null);
  assert.equal(cartLineKey("product", "red", "M"), cartLineKey("product", " red ", "M"));
  assert.notEqual(cartLineKey("product", "red", "M"), cartLineKey("product", "blue", "M"));
  assert.equal(cartLineKey("product"), JSON.stringify(["product", null, null, null]));
  assert.notEqual(cartLineKey("product", null, null, "variant_black_m"), cartLineKey("product", null, null, "variant_white_m"));
});

test("completed checkout removes only purchased quantities and preserves unrelated cart lines", () => {
  const red = cartLineKey("product", "red", "M");
  const blue = cartLineKey("product", "blue", "M");
  const remaining = removePurchasedCartLines(
    [{ lineKey: red, quantity: 3, label: "red" }, { lineKey: blue, quantity: 1, label: "blue" }],
    [{ lineKey: red, quantity: 2 }],
  );
  assert.deepEqual(remaining, [{ lineKey: red, quantity: 1, label: "red" }, { lineKey: blue, quantity: 1, label: "blue" }]);
  assert.deepEqual(removePurchasedCartLines(remaining, []), remaining);
});
