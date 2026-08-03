import test from "node:test";
import assert from "node:assert/strict";
import { isNavigationActive, localizedPath, navigationBackFallback, pathWithoutLocale } from "../lib/navigation";

test("navigation paths preserve locale while matching localized and nested routes", () => {
  assert.equal(localizedPath("fr", "/cart"), "/fr/cart");
  assert.equal(localizedPath("ku", "/"), "/ku");
  assert.equal(pathWithoutLocale("/ar/seller/products/123/edit?tab=stock#form"), "/seller/products/123/edit");
  assert.equal(isNavigationActive("/fr", "/fr"), true);
  assert.equal(isNavigationActive("/fr/product/123", "/fr"), false);
  assert.equal(isNavigationActive("/de/seller/products/123/edit", "/de/seller/products", true), true);
  assert.equal(isNavigationActive("/de/seller/products-new", "/de/seller/products", true), false);
});

test("Back fallbacks stay inside the localized Todijo destination", () => {
  assert.equal(navigationBackFallback("/fr/product/123", "fr"), "/fr");
  assert.equal(navigationBackFallback("/ku/seller/products/new", "ku"), "/ku/dashboard");
  assert.equal(navigationBackFallback("/ar/account/orders/123", "ar"), "/ar/dashboard");
  assert.equal(navigationBackFallback("/nl/verify-email", "nl"), "/nl/login");
});
