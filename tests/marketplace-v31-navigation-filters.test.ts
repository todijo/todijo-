import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalMarketplaceColor, canonicalMarketplaceCountry, countryAliasesForCode, marketplaceColorAliases, marketplaceColorSwatch } from "../lib/marketplace-facets";
import { marketplaceUrl, normalizeMarketplaceSearch } from "../lib/marketplace-search";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("normalizes multilingual colors and rejects supplier/model codes", () => {
    assert.equal(canonicalMarketplaceColor("White"), "white");
    assert.equal(canonicalMarketplaceColor("blanc"), "white");
    assert.equal(canonicalMarketplaceColor("سپی"), "white");
    assert.equal(canonicalMarketplaceColor("Black Pants Fleece Lined"), "black");
    assert.equal(canonicalMarketplaceColor("GXT660"), null);
    assert.equal(canonicalMarketplaceColor("Color 3"), null);
    assert.equal(marketplaceColorSwatch("black"), "#111111");
    assert.ok(marketplaceColorAliases("white").includes("white"));
  });

test("uses canonical country codes with multilingual seller-origin aliases", () => {
    const aliases = countryAliasesForCode("FR").map((value) => value.toLowerCase());
    assert.ok(aliases.includes("fr"));
    assert.ok(aliases.some((value) => value.includes("france")));
    assert.equal(canonicalMarketplaceCountry("France"), "FR");
    assert.equal(canonicalMarketplaceCountry("france"), "FR");
    assert.equal(canonicalMarketplaceCountry("fr"), "FR");
    assert.equal(canonicalMarketplaceCountry("Germany"), "DE");
    assert.equal(normalizeMarketplaceSearch({ country: "france" }).filters.country, "FR");
  });

test("canonicalizes shareable color state and safely normalizes an inverted price range", () => {
  const normalized = normalizeMarketplaceSearch({ country: "France", color: "Blanc", minPrice: "10", maxPrice: "2" });
  assert.equal(normalized.filters.color, "white");
  assert.equal(normalized.invalidPriceRange, true);
  assert.match(marketplaceUrl("fr", normalized.filters), /country=FR/);
  assert.match(marketplaceUrl("fr", normalized.filters), /color=white/);
  assert.match(marketplaceUrl("fr", normalized.filters), /minPrice=2&maxPrice=10/);
});

test("puts the shared filter dock back on buyer product/info headers", () => {
    const siteHeader = read("components/SiteHeader.tsx");
    const sharedHeader = read("components/MarketplaceHeader.tsx");
    assert.ok(siteHeader.includes("<MarketplaceHeader showFilterDock/>"));
    assert.ok(sharedHeader.includes("<MarketplaceBrowseFilterBar/>"));
    assert.ok(sharedHeader.includes("marketCategoryNavigationBelowFilters"));
  });

test("keeps the category rail visible below an open desktop filter panel", () => {
    const css = read("app/globals.css");
    assert.ok(css.includes(".marketHeader>.marketFilterDockV3 .marketFacetPopover{top:188px}"));
    assert.ok(css.includes(".buyerHomePage>.marketFilterDockV3 .marketFacetPopover{top:188px}"));
  });

test("keeps seller origin separate from buyer shipping and themes the detail skeleton", () => {
  const page = read("app/page.tsx");
  const pricing = read("app/api/products/[id]/dropshipping-pricing/route.ts");
  const checkout = read("lib/payments.ts");
  const loading = read("app/product/[id]/loading.tsx");
  const css = read("app/globals.css");
  assert.match(page, /store:[\s\S]*country: \{ equals: alias/);
  assert.match(pricing, /countryCode|destinationCountry|shipping/i);
  assert.match(checkout, /shipping|delivery|country/i);
  assert.ok(loading.includes("productDetailLoadingSkeleton"));
  assert.ok(css.includes(".productDetailLoadingSkeleton .pageSkeleton"));
});

test("mega menu is closed by default, Escape-closeable, and Violet Royal", () => {
  const navigation = read("components/MarketplaceCategoryNavigation.tsx");
  const css = read("app/globals.css");
  assert.ok(navigation.includes("useState(false)"));
  assert.ok(navigation.includes('event.key === "Escape"'));
  assert.ok(navigation.includes("setOpen(false)"));
  assert.match(css, /marketQuickMegaSidebar button\.active\{background:#efe7ff;color:#5b21b6/);
});
