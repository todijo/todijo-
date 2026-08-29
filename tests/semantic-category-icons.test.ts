import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref } from "../lib/desktop-category-taxonomy";
import { categoryNavigationMessages } from "../i18n/category-navigation";

const source = (path: string) => readFileSync(path, "utf8");

test("all canonical parent categories have one shared semantic icon and controlled accent", () => {
  const component = source("components/SemanticCategoryIcon.tsx");
  for (const category of DESKTOP_CATEGORY_TAXONOMY) {
    assert.match(component, new RegExp(`(?:"${category.id}"|${category.id}): \\{ icon:`));
  }
  for (const accent of ["violet", "pink", "orange", "blue", "turquoise", "green", "yellow", "coral"]) assert.match(source("app/globals.css"), new RegExp(`--category-${accent}-bg`));
  assert.doesNotMatch(component, /https?:\/\//);
  assert.doesNotMatch(component, /style=\{\{/);
});

test("canonical category destinations remain locale-aware and unchanged", () => {
  for (const locale of ["fr", "en", "ar", "ku"]) for (const category of DESKTOP_CATEGORY_TAXONOMY) {
    assert.equal(categorySearchHref(locale, category.label), `/${locale}/search?category=${encodeURIComponent(category.label)}`);
  }
});

test("all supported locales have complete parent-category labels", () => {
  const expected = DESKTOP_CATEGORY_TAXONOMY.map(category => category.id).sort();
  for (const [locale, labels] of Object.entries(categoryNavigationMessages)) assert.deepEqual(Object.keys(labels).sort(), expected, `category label parity: ${locale}`);
  assert.equal(categoryNavigationMessages.en.women, "Women's clothing");
  assert.equal(categoryNavigationMessages.fr.women, "Vêtements pour femmes");
  assert.notEqual(categoryNavigationMessages.en.pets, DESKTOP_CATEGORY_TAXONOMY[1].label);
  assert.equal(categorySearchHref("en", DESKTOP_CATEGORY_TAXONOMY[1].label), "/en/search?category=Fournitures%20pour%20animaux%20de%20compagnie");
  assert.notEqual(categoryNavigationMessages.ar.women, DESKTOP_CATEGORY_TAXONOMY[0].label);
  assert.notEqual(categoryNavigationMessages.ku.women, DESKTOP_CATEGORY_TAXONOMY[0].label);
});

test("desktop rail and mega menu reuse the shared semantic category component", () => {
  const navigation = source("components/MarketplaceCategoryNavigation.tsx");
  assert.equal((navigation.match(/import SemanticCategoryIcon/g) ?? []).length, 1);
  assert.match(navigation, /<SemanticCategoryIcon category=\{category\.id\}/);
  assert.match(navigation, /categoryTitle\(category\.id\)/);
  assert.doesNotMatch(navigation, /const categoryIcons/);
  assert.match(navigation, /aria-pressed=\{active\.id === category\.id\}/);
  assert.match(navigation, /event\.key === "Escape"/);
});

test("homepage shortcuts and mobile category browser reuse semantic icons", () => {
  const home = source("app/HomeClient.tsx");
  const mobile = source("components/BuyerMobileNavigation.tsx");
  assert.match(home, /categoryShowcaseSemanticIcon/);
  assert.match(home, /displayCategory\(category\)/);
  assert.match(mobile, /buyerMobileCategoryParentIcon/);
  assert.match(mobile, /role="tab" aria-selected=/);
  assert.match(mobile, /subcategoryImagePath/);
  assert.doesNotMatch(mobile, /const categoryArtwork/);
});

test("responsive and RTL-safe category presentation is explicit", () => {
  const css = source("app/globals.css");
  assert.match(css, /@media\(max-width:860px\)[^{]*\{[^}]*\.marketCategoryNavigation/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /border-inline-start-width:4px/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("Phase 2 identity and localized major headings remain intact", () => {
  const home = source("app/HomeClient.tsx");
  assert.match(home, /h\("heroTitle"\)/);
  assert.match(home, /title=\{h\("newArrivals"\)\}/);
  assert.match(home, /id="featured-stores-title"/);
  assert.match(home, /d\("storesTitle"\)/);
  assert.match(source("app/globals.css"), /\.marketHeader \.buyerMarketTrigger\{[^}]*color:#fff!important/);
});

test("catalog isolation and presentation-only scope remain protected", () => {
  assert.match(source("lib/admin-access.ts"), /dataClass:\s*"PRODUCTION"/);
  assert.match(source("app/page.tsx"), /publicProductAccessWhere/);
  assert.match(source("app/page.tsx"), /publicStoreAccessWhere/);
  assert.equal(readdirSync("prisma/migrations").some(name => /semantic|category.?icon|phase.?3/i.test(name)), false);
});
