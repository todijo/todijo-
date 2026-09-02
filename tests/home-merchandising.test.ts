import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/HomeClient.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("home rails use linked headings with a localized view-all action", () => {
  assert.match(home, /titleHref=\{`\/\$\{activeLocale\}\?sort=newest#products`\}/);
  assert.match(home, /titleHref=\{`\/\$\{activeLocale\}\/best-sellers`\}/);
  assert.match(home, /<ProductRail[^>]+viewAll=\{h\("viewAll"\)\}/);
});

test("best sellers are placed before the store discovery area", () => {
  const best = home.indexOf('id="best-sellers"');
  const stores = home.indexOf('className="container featuredStores"');
  assert.ok(best >= 0 && stores >= 0 && best < stores);
});

test("wide desktop product discovery uses five columns and one hundred products per page", () => {
  const pagination = readFileSync("lib/buyer-marketplace-pagination.ts", "utf8");
  assert.match(pagination, /BUYER_PRODUCT_PAGE_SIZE = 100/);
  assert.match(page, /pageSize=\{BUYER_PRODUCT_PAGE_SIZE\}/);
  assert.match(css, /@media\(min-width:1241px\)\{\.buyerHomePage \.discoveryProductGrid,\.storeIndexPage \.featuredStoreGrid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}\}/);
});

test("seller discovery routes through public seller information and store directory", () => {
  assert.match(home, /sellerGrowthPrimary[^\n]+href=\{`\/\$\{activeLocale\}\/sell`\}/);
  assert.match(home, /sellerGrowthSecondary[^\n]+href=\{`\/\$\{activeLocale\}\/store`\}/);
  assert.match(home, /discoveryHeroSellerCta[^\n]+href=\{`\/\$\{activeLocale\}\/sell`\}/);
});

test("dedicated best seller and seller introduction pages exist", () => {
  const best = readFileSync("app/best-sellers/page.tsx", "utf8");
  const sell = readFileSync("app/sell/page.tsx", "utf8");
  assert.match(best, /orderItem\.groupBy/);
  assert.match(best, /take: LIMIT/);
  assert.match(sell, /sellerPlans\(\)/);
  assert.match(sell, /register\?role=seller&plan=/);
});
