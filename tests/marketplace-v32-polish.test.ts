import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { MARKETPLACE_COLOR_KEYS, canonicalMarketplaceColor, marketplaceColorSwatch } from "../lib/marketplace-facets";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("buyer palette exposes every canonical semantic color with a deterministic swatch", () => {
  for (const color of ["blue","yellow","orange","purple","brown","beige","navy","burgundy","olive","turquoise","cyan","gold","silver"]) {
    assert.ok(MARKETPLACE_COLOR_KEYS.includes(color as never));
    assert.notEqual(marketplaceColorSwatch(color), "#e5e7eb");
  }
  assert.equal(canonicalMarketplaceColor("White"), "white");
  assert.equal(canonicalMarketplaceColor("سپی"), "white");
  assert.equal(canonicalMarketplaceColor("noir"), "black");
  assert.equal(canonicalMarketplaceColor("GXT660"), null);
  assert.equal(canonicalMarketplaceColor("Color 1"), null);
  assert.equal(canonicalMarketplaceColor("SKU-123"), null);
});

test("single-choice facet commits state and closes before navigation", () => {
  const dock = read("components/MarketplaceFilterDock.tsx");
  assert.match(dock, /setFilters\(next\);[\s\S]*setOpenFacet\(null\);[\s\S]*onSelect\?\.\(next\)/);
  for (const key of ["sort","condition","country","size","color","season","rating"]) assert.match(dock, new RegExp(`select\\("${key}"`));
  assert.match(dock, /MARKETPLACE_COLOR_KEYS/);
  assert.match(dock, /variantColors\.\$\{filters\.color\}/);
});

test("homepage sticky boundary keeps categories below filters and panels below categories", () => {
  const home = read("app/HomeClient.tsx");
  const css = read("app/globals.css");
  assert.match(home, /marketCategoryStickyBoundary/);
  assert.match(css, /marketCategoryStickyBoundary\{position:sticky;top:134px;z-index:110\}/);
  assert.match(css, /marketFacetPopover\{top:188px\}/);
});

test("mega menu remains closed, keyboard-safe, and lavender rather than legacy green", () => {
  const nav = read("components/MarketplaceCategoryNavigation.tsx");
  const css = read("app/globals.css");
  assert.match(nav, /useState\(false\)/);
  assert.match(nav, /event\.key === "Escape"/);
  assert.match(nav, /className="marketQuickMegaSubcategoryLink"/);
  assert.match(css, /marketQuickMegaColumns a\.marketQuickMegaSubcategoryLink:hover[^}]*#f2eaff[^}]*#5b21b6/);
  assert.doesNotMatch(css, /a\.marketQuickMegaSubcategoryLink[^}]*background:#0[0-9a-f]{5}/i);
});
