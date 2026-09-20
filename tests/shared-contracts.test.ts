import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ERROR_CODES,
  MARKETPLACE_SORTS,
  MOBILE_REGISTRATION_CALLBACK,
  TODIJO_LOCALES,
  TODIJO_RTL_LOCALES,
  type BuyerProductDetailResponse,
  type CartLineIdentity,
  type CategoryTreeResponse,
  type HomeResponse,
  type MarketplaceListResponse,
} from "@todijo/contracts";

test("root imports the framework-independent shared contract package", () => {
  assert.equal(TODIJO_LOCALES.length, 14);
  assert.deepEqual([...TODIJO_RTL_LOCALES].sort(), ["ar", "fa", "ku"]);
  assert.deepEqual(MARKETPLACE_SORTS, ["newest", "price-asc", "price-desc", "best-selling"]);
  assert.equal(MOBILE_REGISTRATION_CALLBACK, "todijo://auth/registration");
  assert.ok(AUTH_ERROR_CODES.includes("SESSION_EXPIRED"));
});

test("buyer route response contracts and cart identity remain serializable data", () => {
  const list = { products: [], hasMore: false, nextOffset: 0 } satisfies MarketplaceListResponse;
  const categories = { locale: "fr", direction: "ltr", categories: [] } satisfies CategoryTreeResponse;
  const home = { locale: "fr", market: { country: "FR", currency: "EUR" }, sections: { hero: [], categories: [], newArrivals: [], bestSellers: [], stores: { visible: false, threshold: 5, items: [] } } } satisfies HomeResponse;
  const cart = { productId: "product", variantId: null, quantity: 1 } satisfies CartLineIdentity;
  const detail = null as BuyerProductDetailResponse | null;
  assert.deepEqual({ list, categories, home, cart, detail }, { list, categories, home, cart, detail: null });
});
