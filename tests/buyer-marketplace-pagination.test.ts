import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUYER_PRODUCT_PAGE_SIZE, buyerProductPage, buyerProductPageCount } from "../lib/buyer-marketplace-pagination";
import { marketplaceUrl, type MarketplaceFilters } from "../lib/marketplace-search";

test("buyer marketplace pagination applies an authoritative 100-row database window", () => {
  assert.equal(BUYER_PRODUCT_PAGE_SIZE, 100);
  assert.deepEqual(buyerProductPage(1), { skip: 0, take: 100 });
  assert.deepEqual(buyerProductPage(2), { skip: 100, take: 100 });
  assert.deepEqual(buyerProductPage(3), { skip: 200, take: 100 });
  assert.equal(buyerProductPageCount(86), 1);
  assert.equal(buyerProductPageCount(220), 3);

  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /const pagination = buyerProductPage\(requestedPage\)/);
  assert.match(page, /where, orderBy, \.\.\.pagination, select: productSelect/);
  assert.match(page, /orderItem\.groupBy\([\s\S]*?\.\.\.pagination/);
  assert.doesNotMatch(page, /productsForPage[\s\S]*?\.slice\(/);
});

test("pagination URLs retain every buyer filter and sort value", () => {
  const filters: MarketplaceFilters = {
    q: "camera", category: "Electronics", condition: "NEW", country: "FR", rating: "4",
    sort: "price-asc", minPrice: "10", maxPrice: "500", availability: "in-stock",
    color: "blue", size: "M", season: "Summer",
  };
  assert.equal(marketplaceUrl("ar", filters, 2), "/ar/search?q=camera&category=Electronics&condition=NEW&country=FR&rating=4&minPrice=10&maxPrice=500&availability=in-stock&color=blue&size=M&season=Summer&sort=price-asc&page=2");
});

test("wide buyer and store grids share safe gutters while tablet and mobile rules remain", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.buyerHomePage \.discoveryLayout,\.storeIndexPage \.featuredStores\{width:min\(1840px,calc\(100% - 48px\)\)\}/);
  assert.match(css, /@media\(min-width:1241px\)[^\n]*repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1240px\)[\s\S]*?\.featuredStoreGrid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:860px\)[\s\S]*?\.discoveryProductGrid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.buyerHomePage\{overflow-x:clip/);
  assert.match(css, /\.storeIndexPage\{overflow-x:clip\}/);
});

test("marketplace cards explicitly lazy-load non-priority product images", () => {
  const card = readFileSync("components/MarketplaceProductCard.tsx", "utf8");
  assert.match(card, /loading="lazy"/);
  assert.doesNotMatch(card, /priority(?:=|\/>)/);
});
