import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_STORE_DESKTOP_PAGE_SIZE,
  PUBLIC_STORE_MOBILE_PAGE_SIZE,
  publicStorePageSize,
} from "../lib/public-store-pagination";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("public store keeps desktop pagination and expands only mobile requests", () => {
  assert.equal(PUBLIC_STORE_DESKTOP_PAGE_SIZE, 24);
  assert.equal(PUBLIC_STORE_MOBILE_PAGE_SIZE, 100);
  assert.equal(publicStorePageSize("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140"), 24);
  assert.equal(publicStorePageSize("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile"), 100);
  assert.equal(publicStorePageSize("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile"), 100);
  assert.equal(publicStorePageSize("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile"), 100);
  assert.equal(publicStorePageSize("Mozilla/5.0 (X11; Linux x86_64) Chrome/140", "?1"), 100);
});

test("responsive store grid reuses the marketplace card and remains two columns at narrow widths", () => {
  const experience = read("app", "store", "[slug]", "StoreExperience.tsx");
  const css = read("app", "globals.css");
  assert.match(experience, /<MarketplaceProductCard/);
  assert.match(experience, /premiumProductGrid marketplaceStoreProductGrid/);
  assert.match(css, /@media\(max-width:700px\)\{\.premiumStorePage \.marketplaceStoreProductGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:420px\)\{\.marketplaceStoreProductGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /\.premiumStorePage \.marketplaceStoreProductGrid \.discoveryImageWrap>img\{[^}]*object-fit:contain!important/);
});

test("desktop store grid and pagination defaults remain unchanged", () => {
  const css = read("app", "globals.css");
  assert.match(css, /\.marketplaceStoreProductGrid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css, /\.publicStorePagination\{[^}]*margin:28px 0 0\}/);
  assert.match(css, /\.mobileStoreDirectoryLink\{display:none\}/);
});

test("mobile pagination preserves state, anchor, locale, and localized store directory", () => {
  const experience = read("app", "store", "[slug]", "StoreExperience.tsx");
  assert.match(experience, /if \(query\.trim\(\)\) params\.set\("q", query\.trim\(\)\)/);
  assert.match(experience, /if \(sort !== "newest"\) params\.set\("sort", sort\)/);
  assert.match(experience, /#products/);
  assert.match(experience, /href=\{`\/\$\{locale\}\/store`\}/);
  assert.match(experience, /storeText\("otherStores"\)/);

  for (const locale of ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"]) {
    const messages = JSON.parse(read("messages", "public-store", `${locale}.json`)) as { otherStores?: string };
    assert.ok(messages.otherStores?.trim(), `${locale} must localize the other-stores link`);
  }
});
