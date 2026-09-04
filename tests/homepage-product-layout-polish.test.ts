import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homepageProductTiers, shouldShowHomepageStores } from "../lib/homepage-product-tiers";
import { publicStoreAccessWhere } from "../lib/admin-access";

const source = (path: string) => readFileSync(path, "utf8");

test("homepage product feed partitions in order into six large, medium, and four small cards", () => {
  const products = Array.from({ length: 18 }, (_, id) => ({ id }));
  const tiers = homepageProductTiers(products);
  assert.deepEqual(tiers.large.map(({ id }) => id), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(tiers.medium.map(({ id }) => id), [6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(tiers.small.map(({ id }) => id), [14, 15, 16, 17]);
  assert.deepEqual([...tiers.large, ...tiers.medium, ...tiers.small], products);
  assert.equal(new Set([...tiers.large, ...tiers.medium, ...tiers.small].map(({ id }) => id)).size, products.length);
});

test("short product feeds never duplicate products across tiers", () => {
  for (let count = 0; count < 10; count += 1) {
    const products = Array.from({ length: count }, (_, id) => id);
    const tiers = homepageProductTiers(products);
    assert.deepEqual([...tiers.large, ...tiers.medium, ...tiers.small], products);
  }
});

test("homepage reuses shared card behavior for all three visual tiers", () => {
  const home = source("app/HomeClient.tsx");
  const card = source("components/MarketplaceProductCard.tsx");
  assert.match(home, /productTiers\.large\.map[\s\S]*size="large"/);
  assert.match(home, /productTiers\.medium\.map[\s\S]*MarketplaceProductCard/);
  assert.match(home, /productTiers\.small\.map[\s\S]*size="small"/);
  assert.match(card, /ProductCardWishlist/);
  assert.match(card, /ProductCardAction/);
  assert.match(card, /productPath/);
});

test("store section renders only when four authoritative public stores are returned", () => {
  const home = source("app/HomeClient.tsx");
  const page = source("app/page.tsx");
  for (const count of [0, 1, 2, 3]) assert.equal(shouldShowHomepageStores(count), false);
  assert.equal(shouldShowHomepageStores(4), true);
  assert.match(home, /shouldShowHomepageStores\(stores\.length\) && <section className="container featuredStores"/);
  assert.match(page, /where: \{ \.\.\.publicStoreAccess, products: \{ some: \{ status: "PUBLISHED", dataClass: "PRODUCTION", removedAt: null \} \} \}/);
  assert.match(page, /take: 4/);
  assert.deepEqual(publicStoreAccessWhere(new Date("2026-09-04T00:00:00Z")), {
    dataClass: "PRODUCTION",
    status: "ACTIVE",
    owner: { sellerSuspendedAt: null, deactivatedAt: null },
    OR: [
      { subscription: { is: { status: { in: ["ACTIVE", "TRIALING"] } } } },
      { accessGrants: { some: { source: "ADMIN_EXEMPT", startsAt: { lte: new Date("2026-09-04T00:00:00Z") }, endsAt: null } } },
      { accessGrants: { some: { source: "ADMIN_GRANTED", startsAt: { lte: new Date("2026-09-04T00:00:00Z") }, endsAt: { gt: new Date("2026-09-04T00:00:00Z") } } } },
    ],
  });
});

test("responsive tiers have no placeholder and collapse without document scrolling", () => {
  const home = source("app/HomeClient.tsx");
  const css = source("app/globals.css");
  assert.doesNotMatch(home, /featuredStoresPlaceholder|emptyStores/);
  assert.match(css, /homepageProductTier-large\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:860px\)[\s\S]*homepageProductTier-large,[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:350px\)[\s\S]*grid-template-columns:1fr/);
});
