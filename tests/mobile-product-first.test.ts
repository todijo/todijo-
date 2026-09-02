import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("mobile home incrementally loads deduplicated product batches", () => {
  const home = read("app/HomeClient.tsx");
  const route = read("app/api/marketplace/products/route.ts");
  assert.match(home, /new IntersectionObserver/);
  assert.match(home, /rootMargin: "700px 0px"/);
  assert.match(home, /new Set\(current\.map\(\(product\) => product\.id\)\)/);
  assert.match(home, /const MOBILE_BATCH_SIZE = 24/);
  assert.match(home, /products\.slice\(0, MOBILE_BATCH_SIZE\)/);
  assert.match(route, /const PAGE_SIZE = 24/);
  assert.match(route, /hasMore: offset \+ rows\.length < total/);
  assert.match(route, /nextOffset: offset \+ rows\.length/);
  assert.match(home, /products\.filter\(\(product\) => !seen\.has\(product\.id\)\)/);
});

test("desktop keeps its hundred-product server pagination while mobile starts from server-rendered products", () => {
  const page = read("app/page.tsx");
  const pagination = read("lib/buyer-marketplace-pagination.ts");
  const home = read("app/HomeClient.tsx");
  const css = read("app/globals.css");
  assert.match(pagination, /BUYER_PRODUCT_PAGE_SIZE = 100/);
  assert.match(page, /buyerProductPage\(requestedPage\)/);
  assert.match(page, /products=\{products\}/);
  assert.match(home, /setVisibleProducts\(mobile && page === 1 \? products\.slice\(0, MOBILE_BATCH_SIZE\) : products\)/);
  assert.match(css, /\.buyerHomePage \.pagination\{display:none\}/);
});

test("incremental catalog preserves the server-rendered marketplace safety contract", () => {
  const page = read("app/page.tsx");
  const route = read("app/api/marketplace/products/route.ts");
  for (const contract of [
    "publicProductAccessWhere(now)",
    "publicStoreAccessWhere(now)",
    "productGenerallyAvailableWhere()",
    "categoryFilterValues(category)",
    "marketplaceColorAliases(color)",
    "countryAliasesForCode(country)",
    'status: "PUBLISHED"',
    'status: "PUBLISHED", product: baseWhere',
    '"PAID", "PROCESSING", "SHIPPED", "DELIVERED"',
    "requiresAuthoritativeDropshippingPrice",
    "owner: { firstName:",
    "owner: { lastName:",
  ]) {
    assert.ok(page.includes(contract), `initial query is missing ${contract}`);
    assert.ok(route.includes(contract), `incremental query is missing ${contract}`);
  }
});

test("mobile storefront is product-first and never crops catalog media", () => {
  const css = read("app/globals.css");
  assert.match(css, /Mobile storefront: product-first/);
  assert.match(css, /\.buyerHomePage \.marketplaceDiscoverySections,[\s\S]*?display:none!important/);
  assert.match(css, /\.buyerHomePage \.discoveryImageWrap>img\{[^}]*object-fit:contain!important/);
  assert.match(css, /\.productMobileImageSlide img\{[^}]*object-fit:contain!important/);
});

test("mobile categories are visual and info pages retain category navigation", () => {
  const home = read("app/HomeClient.tsx");
  const drawer = read("components/BuyerMobileNavigation.tsx");
  const header = read("components/SiteHeader.tsx");
  assert.match(home, /SemanticCategoryIcon/);
  assert.match(drawer, /DESKTOP_CATEGORY_TAXONOMY/);
  assert.match(drawer, /buyerMobileCategoryBrowser/);
  assert.match(drawer, /buyerMobileCategoryParentIcon/);
  assert.match(header, /path\.startsWith\("\/info\/"\).*showCategoryNav/);
  assert.match(drawer, /useTranslations\("HomeFooter"\)/);
  assert.match(drawer, /footer\("helpCenter"\)/);
});
