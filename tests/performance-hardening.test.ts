import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PUBLIC_STORE_DESKTOP_PAGE_SIZE,
  PUBLIC_STORE_MOBILE_PAGE_SIZE,
  publicStorePageSize,
} from "../lib/public-store-pagination";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("seller dashboard uses a bounded recent-order query and minimal analytics relations", () => {
  const source = read("app", "dashboard", "page.tsx");
  assert.match(source, /const \[analyticsOrders, sellerOrders,[\s\S]*Promise\.all/);
  assert.match(source, /take: 5, select:/);
  assert.doesNotMatch(source, /include: \{ buyer:[\s\S]*store: \{ select: \{ name: true, slug: true \}/);
});

test("public stores fetch a bounded product page and expose localized navigation", () => {
  const page = read("app", "store", "[slug]", "page.tsx");
  const experience = read("app", "store", "[slug]", "StoreExperience.tsx");
  assert.equal(PUBLIC_STORE_DESKTOP_PAGE_SIZE, 24);
  assert.equal(PUBLIC_STORE_MOBILE_PAGE_SIZE, 100);
  assert.equal(publicStorePageSize("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), 24);
  assert.equal(publicStorePageSize("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile"), 100);
  assert.match(page, /publicStorePageSize\(requestHeaders\.get\("user-agent"\), requestHeaders\.get\("sec-ch-ua-mobile"\)\)/);
  assert.match(page, /skip: \(page - 1\) \* pageSize, take: pageSize/);
  assert.match(page, /Math\.ceil\(store\._count\.products \/ pageSize\)/);
  assert.match(experience, /orders\("history\.pagination"\)/);
  assert.match(experience, /store\.page < store\.pages/);
  assert.match(experience, /`\/\$\{locale\}\/store\/\$\{store\.slug\}\?\$\{params\}#products`/);
  assert.match(experience, /params\.set\("q", query\.trim\(\)\)/);
  assert.match(experience, /params\.set\("sort", sort\)/);
});

test("message read-state writes run concurrently without changing their predicates", () => {
  const source = read("app", "messages", "[id]", "page.tsx");
  assert.match(source, /await Promise\.all\(\[/);
  assert.match(source, /conversationId: id, senderId: \{ not: session\.userId \}, readAt: null/);
  assert.match(source, /href: \{ endsWith: `\/messages\/\$\{id\}` \}, readAt: null/);
});
