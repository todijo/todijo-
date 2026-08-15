import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rendered mega-menu subcategory links own a scoped Violet Royal contract", () => {
  const component = readFileSync("components/MarketplaceCategoryNavigation.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(component, /<Link className="marketQuickMegaSubcategoryLink"[^>]*key=\{item\}/);
  assert.match(css, /\.marketQuickMegaColumns a\.marketQuickMegaSubcategoryLink\{[^}]*border:1px solid #eadff8[^}]*background:#fdfbff[^}]*color:#49395e/);
  assert.match(css, /\.marketQuickMegaColumns a\.marketQuickMegaSubcategoryLink:hover\{[^}]*border-color:#c9b2ea[^}]*background:#f2eaff[^}]*color:#5b21b6/);
  assert.match(css, /\.marketQuickMegaColumns a\.marketQuickMegaSubcategoryLink:focus-visible\{[^}]*outline:3px solid rgba\(124,58,237,\.3\)/);
  assert.doesNotMatch(css, /a\.marketQuickMegaSubcategoryLink[^}]*background:(?:#087653|#075f43|var\(--green\))/i);
});
