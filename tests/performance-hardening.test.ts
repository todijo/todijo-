import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
  assert.match(page, /const STORE_PAGE_SIZE = 24/);
  assert.match(page, /skip: \(page - 1\) \* STORE_PAGE_SIZE, take: STORE_PAGE_SIZE/);
  assert.match(experience, /orders\("history\.pagination"\)/);
  assert.match(experience, /store\.page < store\.pages/);
});

test("message read-state writes run concurrently without changing their predicates", () => {
  const source = read("app", "messages", "[id]", "page.tsx");
  assert.match(source, /await Promise\.all\(\[/);
  assert.match(source, /conversationId: id, senderId: \{ not: session\.userId \}, readAt: null/);
  assert.match(source, /href: \{ endsWith: `\/messages\/\$\{id\}` \}, readAt: null/);
});
