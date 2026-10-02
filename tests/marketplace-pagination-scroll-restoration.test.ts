import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageNumbers } from "../lib/pagination";
import { BUYER_PRODUCT_PAGE_SIZE } from "../lib/buyer-marketplace-pagination";

const read = (path: string) => readFileSync(path, "utf8");

test("desktop pagination keeps a bounded current-page window with stable edges", () => {
  assert.deepEqual(pageNumbers(1, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageNumbers(7, 20), [1, 5, 6, 7, 8, 9, 20]);
  const home = read("app/HomeClient.tsx");
  assert.match(home, /className="pagination"/);
  assert.match(home, /aria-disabled="true"/);
  assert.match(home, /aria-current="page"/);
  assert.match(home, /paginationEllipsis/);
  assert.match(home, /t\.dir === "rtl"/);
  const css = read("app/globals.css");
  assert.match(css, /\.pagination\{[^}]*justify-content:center/);
  assert.match(css, /\.pagination \.isCurrent\{[^}]*background:var\(--green-dark\)/);
  assert.match(css, /\.pagination a:focus-visible/);
});

test("pagination URLs preserve locale, filters, sort and search while only changing page", () => {
  const home = read("app/HomeClient.tsx");
  assert.match(home, /buildUrl\(filters, page - 1\)/);
  assert.match(home, /buildUrl\(filters, number\)/);
  assert.match(home, /buildUrl\(filters, page \+ 1\)/);
  assert.equal(BUYER_PRODUCT_PAGE_SIZE, 100);
  assert.match(read("app/page.tsx"), /buyerProductPage\(requestedPage\)/);
});

test("mobile remains infinite-scroll only and uses single-flight, stale-response and ID dedupe guards", () => {
  const home = read("app/HomeClient.tsx");
  assert.match(home, /new IntersectionObserver/);
  assert.match(home, /inFlightOffsetRef\.current !== null/);
  assert.match(home, /inFlightOffsetRef\.current = offset/);
  assert.match(home, /listingKeyRef\.current !== requestListingKey/);
  assert.match(home, /appendUnique\(current, payload\.products\)/);
  assert.match(home, /setLoadError\(true\)/);
  assert.match(home, /loadMobileBatch\(nextOffset\)/);
  assert.match(read("app/globals.css"), /\.buyerHomePage \.pagination\{display:none\}/);
  assert.match(read("app/api/marketplace/products/route.ts"), /const PAGE_SIZE = 24/);
});

test("back navigation restores listing state by product identity without affecting refresh", () => {
  const home = read("app/HomeClient.tsx");
  const card = read("components/MarketplaceProductCard.tsx");
  assert.match(home, /navigation\?\.type !== "back_forward"/);
  assert.match(home, /saved\.url !== `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`/);
  assert.match(home, /products\.slice\(0, Math\.min\(saved\.nextOffset, products\.length\)\)/);
  assert.match(home, /marketplace-product-\$\{saved\.productId\}/);
  assert.match(home, /scrollIntoView\(\{ block: "center" \}\)/);
  assert.match(card, /id=\{`marketplace-product-\$\{product\.id\}`\}/);
  assert.match(card, /onProductNavigate\?\.\(product\.id\)/);
});
