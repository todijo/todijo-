import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { homepageLowPricePage, homepageLowPricePageCount, homepageLowPriceWhere, HOMEPAGE_LOW_PRICE_MAX, HOMEPAGE_LOW_PRICE_MIN, HOMEPAGE_LOW_PRICE_PAGE_SIZE } from "../lib/homepage-low-price-products";

test("homepage low-price section uses the requested EUR range, availability, and twelve-item pages", () => {
  const where = homepageLowPriceWhere({ dataClass: "PRODUCTION" });
  assert.equal(HOMEPAGE_LOW_PRICE_MIN, "0.50");
  assert.equal(HOMEPAGE_LOW_PRICE_MAX, "4.00");
  assert.equal(HOMEPAGE_LOW_PRICE_PAGE_SIZE, 12);
  assert.equal(where.currency, "EUR");
  assert.deepEqual(where.price, { gte: "0.50", lte: "4.00" });
  assert.equal(where.status, "PUBLISHED");
  assert.ok(Array.isArray(where.AND));
  const serialized = JSON.stringify(where);
  assert.match(serialized, /MANUAL_OVERRIDE/);
  assert.match(serialized, /shippingStatus/);
  assert.match(serialized, /"gt":0/);
});

test("low-price page inputs are bounded and query pagination is independent of marketplace results", () => {
  assert.equal(homepageLowPricePage("3"), 3);
  assert.equal(homepageLowPricePage("-1"), 1);
  assert.equal(homepageLowPricePage("2.5"), 1);
  assert.equal(homepageLowPricePage(undefined), 1);
  assert.equal(homepageLowPricePageCount(25), 3);
  assert.equal(homepageLowPricePageCount(0), 1);
  const home = readFileSync("app/HomeClient.tsx", "utf8");
  assert.match(home, /`\/\$\{activeLocale\}\?lowPricePage=\$\{nextPage\}#low-price-products`/);
  assert.match(home, /homepageLowPricePagination/);
  assert.match(home, /aria-current="page"/);
  assert.match(home, /href=\{lowPriceUrl\(lowPricePage \+ 1\)\}/);
  assert.doesNotMatch(home, /lowPriceUrl[^\n]+\/search/);
});

test("homepage low-price section has six desktop columns and responsive tablet/mobile grids", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.homepageLowPriceGrid\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1100px\) and \(min-width:861px\)\{\.homepageLowPriceGrid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /@media\(max-width:860px\)[^\n]*\.homepageLowPriceGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
