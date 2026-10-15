import assert from "node:assert/strict";
import test from "node:test";
import { assertSellerProductQuickUpdateEligible, parseSellerProductQuickUpdate, SellerProductQuickUpdateError } from "../lib/seller-product-quick-update";

test("quick product updates accept only explicitly changed price and stock fields", () => {
  assert.deepEqual(parseSellerProductQuickUpdate({ price: "12.50" }), { price: "12.50" });
  assert.deepEqual(parseSellerProductQuickUpdate({ stock: 0 }), { stock: 0 });
  assert.deepEqual(parseSellerProductQuickUpdate({ price: "12", stock: "4" }), { price: "12", stock: 4 });
});

test("quick product updates reject unknown fields and empty mutations", () => {
  for (const input of [{}, { status: "PUBLISHED" }, { price: "9.99", storeId: "another-store" }]) {
    assert.throws(() => parseSellerProductQuickUpdate(input), SellerProductQuickUpdateError);
  }
});

test("quick edit is limited to plain products and excludes variants and supplier-managed items", () => {
  assert.equal(assertSellerProductQuickUpdateEligible({ optionCount: 0, variantCount: 0, supplierManaged: false }), undefined);
  for (const input of [{ optionCount: 1, variantCount: 0, supplierManaged: false }, { optionCount: 0, variantCount: 1, supplierManaged: false }, { optionCount: 0, variantCount: 0, supplierManaged: true }]) {
    assert.throws(() => assertSellerProductQuickUpdateEligible(input), (error: unknown) => error instanceof SellerProductQuickUpdateError && error.status === 409);
  }
});

test("quick price and stock values retain the product editor bounds and precision", () => {
  for (const price of ["0", "1000000.01", "1.999", "1e2", "NaN"]) assert.throws(() => parseSellerProductQuickUpdate({ price }), (error: unknown) => error instanceof SellerProductQuickUpdateError && error.code === "INVALID_PRICE");
  for (const stock of [-1, 1.5, 1_000_001, "1.5"]) assert.throws(() => parseSellerProductQuickUpdate({ stock }), (error: unknown) => error instanceof SellerProductQuickUpdateError && error.code === "INVALID_STOCK");
});
