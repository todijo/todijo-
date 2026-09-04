import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOMEPAGE_HERO_PRODUCT_COUNT, selectDistinctHeroProducts, shouldShowHomepageStores } from "../lib/homepage-merchandising";
import { publicStoreAccessWhere } from "../lib/admin-access";

const source = (path: string) => readFileSync(path, "utf8");

test("hero selects at most six distinct products without changing source order", () => {
  const products = [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }, { id: "g" }];
  assert.equal(HOMEPAGE_HERO_PRODUCT_COUNT, 6);
  assert.deepEqual(selectDistinctHeroProducts(products).map(({ id }) => id), ["a", "b", "c", "d", "e", "f"]);
});

test("hero query reuses public eligibility and requests the six-product composition", () => {
  const page = source("app/page.tsx");
  assert.match(page, /HOMEPAGE_HERO_PRODUCT_COUNT/);
  assert.match(page, /where: \{ status: "PUBLISHED", \.\.\.publicProductAccess, images: \{ isEmpty: false \} \}/);
  assert.match(page, /take: heroTake/);
  assert.doesNotMatch(page, /heroRows[\s\S]{0,300}dataClass:\s*["']TEST/);
});

test("hero renders one large, one medium, and four small linked product tiles", () => {
  const home = source("app/HomeClient.tsx");
  const css = source("app/globals.css");
  assert.match(home, /featuredProducts\.map/);
  assert.match(home, /index === 0 \? "heroProduct-large" : index === 1 \? "heroProduct-medium" : "heroProduct-small"/);
  assert.match(home, /productPath\(activeLocale,product\.id,product\.name\)/);
  assert.match(home, /BuyerProductPrice/);
  assert.match(css, /\.heroProduct-large\{grid-column:1;grid-row:1\/-1\}/);
  assert.match(css, /\.heroProduct-medium\{grid-column:2;grid-row:1\/-1\}/);
  for (const index of [3, 4, 5, 6]) assert.match(css, new RegExp(`\\.premiumHeroProducts \\.heroProduct-${index}\\{`));
});

test("main products use the established grid and shared card behavior", () => {
  const home = source("app/HomeClient.tsx");
  const card = source("components/MarketplaceProductCard.tsx");
  const css = source("app/globals.css");
  assert.match(home, /<div className="discoveryProductGrid">[\s\S]*visibleProducts\.map/);
  assert.doesNotMatch(home, /homepageTieredProducts|homepageProductTier|productTiers/);
  assert.doesNotMatch(css, /homepageTieredProducts|homepageProductTier/);
  assert.match(card, /ProductCardWishlist/);
  assert.match(card, /ProductCardAction/);
  assert.match(card, /productPath/);
});

test("store section renders only at the authoritative four-store threshold", () => {
  const home = source("app/HomeClient.tsx");
  const page = source("app/page.tsx");
  for (const count of [0, 1, 2, 3]) assert.equal(shouldShowHomepageStores(count), false);
  assert.equal(shouldShowHomepageStores(4), true);
  assert.match(home, /shouldShowHomepageStores\(stores\.length\) && <section className="container featuredStores"/);
  assert.doesNotMatch(home, /featuredStoresPlaceholder|emptyStores/);
  assert.match(page, /where: \{ \.\.\.publicStoreAccess, products: \{ some: \{ status: "PUBLISHED", dataClass: "PRODUCTION", removedAt: null \} \} \}/);
  assert.match(page, /take: 4/);
  assert.deepEqual(publicStoreAccessWhere(new Date("2026-09-04T00:00:00Z")), {
    dataClass: "PRODUCTION", status: "ACTIVE", owner: { sellerSuspendedAt: null, deactivatedAt: null },
    OR: [
      { subscription: { is: { status: { in: ["ACTIVE", "TRIALING"] } } } },
      { accessGrants: { some: { source: "ADMIN_EXEMPT", startsAt: { lte: new Date("2026-09-04T00:00:00Z") }, endsAt: null } } },
      { accessGrants: { some: { source: "ADMIN_GRANTED", startsAt: { lte: new Date("2026-09-04T00:00:00Z") }, endsAt: { gt: new Date("2026-09-04T00:00:00Z") } } } },
    ],
  });
});
