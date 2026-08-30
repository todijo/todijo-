import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { CART_RECOMMENDATION_LIMIT, mergeCartRecommendations } from "../lib/cart-recommendations";
import { locales, rtlLocales } from "../i18n/config";

test("similar products lead and recent products fill remaining positions", () => {
  const similar = [{id:"similar-new"},{id:"similar-old"}];
  const recent = [{id:"recent-new"},{id:"recent-old"}];
  assert.deepEqual(mergeCartRecommendations(similar, recent, ["cart-item"]), {
    products: [...similar, ...recent], source: "similar",
  });
});

test("cart products and duplicate candidates are excluded and results are capped", () => {
  const result = mergeCartRecommendations(
    [{id:"cart-item"},{id:"one"},{id:"one"},{id:"two"}],
    [{id:"two"},{id:"three"},{id:"four"},{id:"five"}],
    ["cart-item"],
  );
  assert.equal(CART_RECOMMENDATION_LIMIT, 4);
  assert.deepEqual(result.products.map(({id})=>id), ["one","two","three","four"]);
});

test("recent products are the clean fallback when no category match exists", () => {
  const recent = [{id:"newest"},{id:"next"}];
  assert.deepEqual(mergeCartRecommendations([], recent, ["cart-item"]), {products:recent,source:"recent"});
  assert.deepEqual(mergeCartRecommendations([], [], ["cart-item"]), {products:[],source:"recent"});
});

test("recommendation endpoint preserves marketplace visibility and deterministic bounded queries", async () => {
  const route = await readFile("app/api/cart/recommendations/route.ts", "utf8");
  assert.match(route, /publicProductAccessWhere\(\)/);
  assert.equal(route.match(/status: "PUBLISHED"/g)?.length, 3);
  assert.match(route, /orderBy:[\s\S]*createdAt: "desc"[\s\S]*id: "asc"/);
  assert.match(route, /take: CART_RECOMMENDATION_LIMIT/);
  assert.match(route, /id: \{ notIn: \[\.\.\.productIds, \.\.\.similarIds\] \}/);
  assert.match(route, /console\.error\("Cart recommendations unavailable", error\)/);
  assert.match(route, /return NextResponse\.json\(\{ products: \[\], source: "recent" \}\)/);
  assert.doesNotMatch(route, /\$queryRaw|groupBy|analytics|tracking/);
});

test("Cart uses the shared product card, hides empty results, and leaves totals and checkout intact", async () => {
  const [cart, recommendations, card] = await Promise.all([
    readFile("app/cart/page.tsx", "utf8"),
    readFile("components/CartRecommendations.tsx", "utf8"),
    readFile("components/MarketplaceProductCard.tsx", "utf8"),
  ]);
  assert.match(cart, /<CartRecommendations productIds=\{items\.map\(\(item\) => item\.id\)\}\/>/);
  assert.match(cart, /formatCurrency\(subtotal, currency, locale\)/);
  assert.match(cart, /href="\/checkout"/);
  assert.match(recommendations, /if \(!result\?\.products\.length\) return null/);
  assert.match(recommendations, /<MarketplaceProductCard/);
  assert.match(card, /categoryLabel\(product\.category/);
  assert.match(card, /href=\{productPath\(locale,product\.id,product\.name\)\}/);
});

test("recommendations expose a matched skeleton and responsive non-overflow layout", async () => {
  const [component, css] = await Promise.all([readFile("components/CartRecommendations.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(component, /aria-busy="true"/);
  assert.match(component, /cartRecommendationSkeleton/);
  assert.match(css, /grid-template-areas:"items summary" "recommendations summary"/);
  assert.match(css, /@media\(max-width:900px\)\{\.cartLayout\{grid-template-areas:"items" "summary" "recommendations"\}/);
  assert.match(css, /\.cartRecommendationGrid\{display:flex;[^}]*overflow-x:auto;[^}]*scroll-snap-type:inline mandatory/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^{]*\{\.cartRecommendationSkeleton/);
});

test("recommendation translations have exact parity with RTL and Chinese direction unchanged", async () => {
  const expected = ["eyebrow","loading","recent","similar"];
  for (const locale of locales) {
    const source = await readFile(path.join("messages/cart-recommendations", `${locale}.json`), "utf8");
    assert.deepEqual(Object.keys(JSON.parse(source)).sort(), expected, locale);
    assert.doesNotMatch(source, /\uFFFD|Ãƒ|Ã‚|Ã¢â‚¬/);
  }
  assert.deepEqual([...rtlLocales].sort(), ["ar","fa","ku"]);
  assert.equal(rtlLocales.has("zh"), false);
});
