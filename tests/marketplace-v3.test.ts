import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locales } from "../i18n/config";

const source = (path: string) => readFileSync(path, "utf8");

test("marketplace facets are real query-backed controls with one accessible open panel", () => {
  const dock = source("components/MarketplaceFilterDock.tsx");
  const page = source("app/page.tsx");
  for (const token of ['name="sort-dock"', 'name="condition-dock"', 'name="rating-dock"', 'update("country"', 'update("availability"', 'update("size"', 'update("color"', 'update("season"']) assert.match(dock, new RegExp(token.replace(/[()]/g, "\\$&")));
  assert.match(dock, /setOpenFacet\(\(current\) => current === id \? null : id\)/);
  assert.match(dock, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(dock, /event\.key === "Escape"/);
  assert.match(page, /options: \{ some: \{ active: true, values: \{ some: \{ active: true, value: color \}/);
  assert.match(page, /options: \{ some: \{ active: true, values: \{ some: \{ active: true, value: size \}/);
  assert.match(page, /isSeasonName/);
});

test("buyer navigation keeps the header filters and complete category rail in a sticky stack", () => {
  const css = source("app/globals.css");
  const navigation = source("components/MarketplaceCategoryNavigation.tsx");
  assert.match(css, /\.marketHeader\{position:sticky!important;top:0!important\}/);
  assert.match(css, /\.marketFilterDockV3\{top:103px;z-index:116\}/);
  assert.match(css, /\.marketCategoryNavigationBelowFilters\{display:block!important;position:sticky;top:157px;z-index:112\}/);
  assert.match(navigation, /DESKTOP_CATEGORY_TAXONOMY\.map/);
  assert.doesNotMatch(navigation, /DESKTOP_CATEGORY_TAXONOMY\.slice/);
});

test("cart groups lines by seller and communicates persisted shipping thresholds without changing checkout totals", () => {
  const cart = source("app/cart/page.tsx");
  const provider = source("components/CartProvider.tsx");
  assert.match(cart, /const sellerGroups = useMemo/);
  assert.match(cart, /item\.storeSlug \|\| item\.storeName \|\| "todijo"/);
  assert.match(cart, /className="cartSellerGroup"/);
  assert.match(cart, /shippingFreeThreshold/);
  assert.match(cart, /Math\.max\(0, threshold - group\.subtotal\)/);
  assert.match(cart, /formatCurrency\(subtotal, currency, locale\)/);
  assert.match(provider, /shippingPrice\?: number \| null/);
  assert.match(provider, /shippingFreeThreshold\?: number \| null/);
});

test("Violet Royal store seller info and confirmation surfaces retain semantic contrast", () => {
  const css = source("app/globals.css");
  const store = source("app/store/[slug]/StoreExperience.tsx");
  assert.match(store, /rgba\(45,13,83,\.92\)/);
  assert.match(css, /\.premiumSellerDashboard \.sellerOverviewHero\{background:[^}]*#3b126f/);
  assert.match(css, /\.sellerControlForm \.listingDeclaration\{[^}]*color:#2a1d3b/);
  assert.match(css, /\.marketInfoPage\{[^}]*#f7f2ff/);
  assert.match(css, /\.discoveryPromoBanner,\.sellerGrowthCta\{background:linear-gradient\([^}]*#3b116f/);
});

test("season label exists in every supported locale", () => {
  for (const locale of locales) {
    const messages = JSON.parse(source(`messages/${locale}.json`)) as Record<string, Record<string, string>>;
    assert.ok(messages.Marketplace.season, locale);
  }
});
