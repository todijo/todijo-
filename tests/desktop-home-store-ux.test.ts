import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pageNumbers } from "../lib/pagination";

const source = (path: string) => readFileSync(path, "utf8");

test("homepage pagination stays localized, centered, accessible, and keeps its page destinations", () => {
  const home = source("app/HomeClient.tsx");
  const css = source("app/globals.css");
  assert.match(home, /className="pagination"/);
  assert.match(home, /href=\{buildUrl\(filters, page \+ 1\)\}/);
  assert.match(home, /href=\{buildUrl\(filters, number\)\}/);
  assert.match(home, /aria-current="page"/);
  assert.match(home, /aria-disabled="true"/);
  assert.doesNotMatch(home, /activeLocale === "fr" \? "Voir plus de produits"/);
  assert.match(css, /\.pagination\{[^}]*justify-content:center/);
  assert.match(css, /\.pagination \.isCurrent\{[^}]*background:var\(--green-dark\)[^}]*color:#fff/);
  assert.match(css, /\.pagination a:focus-visible\{outline:3px solid/);
});

test("public store pagination reuses the seller window and preserves locale, filters, and product anchor", () => {
  const store = source("app/store/[slug]/StoreExperience.tsx");
  const sellerPagination = source("lib/seller-products-pagination.ts");
  assert.deepEqual(pageNumbers(1, 15), [1, 2, 3, 15]);
  assert.deepEqual(pageNumbers(8, 15), [1, 6, 7, 8, 9, 10, 15]);
  assert.match(sellerPagination, /pageNumbers as sellerPageNumbers/);
  assert.match(store, /className="sellerProductsPagination publicStorePagination"/);
  assert.match(store, /pageNumbers\(store\.page,store\.pages\)/);
  assert.match(store, /paginationEllipsis/);
  assert.match(store, /if \(query\.trim\(\)\) params\.set\("q", query\.trim\(\)\)/);
  assert.match(store, /if \(sort !== "newest"\) params\.set\("sort", sort\)/);
  assert.match(store, /`\/\$\{locale\}\/store\/\$\{store\.slug\}\?\$\{params\}#products`/);
  assert.match(store, /store\.page > 1 \? <Link/);
  assert.match(store, /store\.page < store\.pages \? <Link/);
});

test("public store seller contact reuses the authenticated pre-purchase dialog without a products jump", () => {
  const page = source("app/store/[slug]/page.tsx");
  const store = source("app/store/[slug]/StoreExperience.tsx");
  const contact = source("components/AskSellerButton.tsx");
  assert.match(page, /readSession\(\)/);
  assert.match(page, /allowPrepurchaseQuestions: true/);
  assert.match(page, /contactProductId: contactProduct\?\.id \?\? null/);
  assert.match(store, /<AskSellerButton productId=\{store\.contactProductId\} loggedIn=\{store\.loggedIn\} className="storeActionButton"\/>/);
  assert.doesNotMatch(store, /href="#products"><MessageCircle/);
  assert.match(contact, /fetch\("\/api\/conversations"/);
  assert.match(contact, /MIN_MESSAGE_LENGTH = 12/);
  assert.match(contact, /router\.push\(`\/login\?next=\$\{encodeURIComponent\(location\.pathname\)\}`\)/);
  assert.match(contact, /role="dialog" aria-modal="true"/);
  assert.match(contact, /onMouseDown=\{\(\) => setOpen\(false\)\}/);
});
