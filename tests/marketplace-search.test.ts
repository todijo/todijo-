import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clearMarketplaceFilters, marketplaceUrl, normalizeMarketplaceSearch, type MarketplaceFilters } from "../lib/marketplace-search";

const filters: MarketplaceFilters = {
  q: "camera & lens", category: "Electronics", condition: "NEW", city: "Paris", country: "France",
  sort: "price-asc", minPrice: "10", maxPrice: "500", availability: "in-stock",
};

test("marketplace URLs preserve locale and encode deterministic shareable state", () => {
  assert.equal(marketplaceUrl("ku", filters, 3), "/ku?q=camera+%26+lens&category=Electronics&condition=NEW&city=Paris&country=France&minPrice=10&maxPrice=500&availability=in-stock&sort=price-asc&page=3#products");
  assert.equal(marketplaceUrl("fr", { ...filters, q: "", sort: "newest" }), "/fr?category=Electronics&condition=NEW&city=Paris&country=France&minPrice=10&maxPrice=500&availability=in-stock#products");
});

test("unsupported and malformed search parameters normalize safely", () => {
  const result = normalizeMarketplaceSearch({ q: "  camera  ", sort: "popular", minPrice: "-1", maxPrice: "oops", availability: "all", page: "-4" });
  assert.deepEqual(result, { filters: { q: "camera", category: "", condition: "", city: "", country: "", sort: "newest", minPrice: "", maxPrice: "", availability: "" }, page: 1, invalidPriceRange: false });
});

test("invalid price ranges are explicit and clearing filters preserves query and sort", () => {
  const result = normalizeMarketplaceSearch({ q: "camera", minPrice: "500", maxPrice: "10", sort: "oldest" });
  assert.equal(result.invalidPriceRange, true);
  assert.deepEqual(clearMarketplaceFilters(result.filters), { ...result.filters, category: "", condition: "", city: "", country: "", minPrice: "", maxPrice: "", availability: "" });
  assert.equal(clearMarketplaceFilters(result.filters).q, "camera");
  assert.equal(clearMarketplaceFilters(result.filters).sort, "oldest");
});

test("search UI uses one locale-safe URL builder, accessible mobile dialog, and localized product links", () => {
  const home = readFileSync("app/HomeClient.tsx", "utf8");
  const server = readFileSync("app/page.tsx", "utf8");
  const mobile = readFileSync("components/BuyerMobileHeader.tsx", "utf8");
  const productCard = readFileSync("components/MarketplaceProductCard.tsx", "utf8");
  assert.match(home, /marketplaceUrl\(activeLocale, nextFilters, nextPage\)/);
  assert.match(home, /role=\{showFilters \? "dialog" : undefined\}/);
  assert.match(home, /aria-modal=\{showFilters \|\| undefined\}/);
  assert.match(home, /event\.key === "Escape"/);
  assert.match(home, /filterTriggerRef\.current\?\.focus\(\)/);
  assert.match(productCard, /href=\{`\/\$\{locale\}\/product\/\$\{product\.id\}`\}/);
  assert.match(mobile, /new URLSearchParams\(window\.location\.search\)\.get\("q"\)/);
  assert.match(server, /const orderBy:[^=]+ = \[primaryOrder, \{ id: "asc" \}\]/);
  assert.match(server, /const normalizedPage = Math\.min\(page, availablePages\)/);
});

test("responsive search controls retain touch targets, RTL positioning, and reduced motion", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /activeFilterChips a\{min-height:44px/);
  assert.match(css, /filterPanel\.show\{position:fixed[^}]+inset-inline-start:0/);
  assert.match(css, /filterClose\{width:44px;height:44px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
