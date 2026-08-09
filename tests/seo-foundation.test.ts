import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales } from "../i18n/config";
import { productStructuredData } from "../lib/product-seo";
import { localizedAlternates } from "../lib/seo";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("all locales provide localized homepage metadata", () => {
  for (const locale of locales) {
    const messages = JSON.parse(read("messages", `${locale}.json`));
    assert.equal(typeof messages.Metadata.title, "string");
    assert.ok(messages.Metadata.title.length > 3);
    assert.equal(typeof messages.Metadata.description, "string");
    assert.ok(messages.Metadata.description.length > 5);
  }
});

test("localized alternates cover every real locale and retain the canonical locale", () => {
  const alternates = localizedAlternates("fr", "product/product_1");
  assert.equal(alternates.canonical, "/fr/product/product_1");
  assert.deepEqual(Object.keys(alternates.languages), [...locales]);
  assert.equal(alternates.languages.ar, "/ar/product/product_1");
});

test("product JSON-LD uses only supplied commerce facts", () => {
  const data = productStructuredData({ id: "p1", name: "Real product", description: "Real description", images: ["https://img.example/p1.jpg"], price: { toString: () => "19.90" }, currency: "EUR", condition: "NEUF", available: true, store: { name: "Seller store", sellerType: "PRIVATE" } }, "fr");
  const parsed = JSON.parse(JSON.stringify(data));
  assert.equal(parsed["@type"], "Product");
  assert.equal(parsed.offers.price, "19.90");
  assert.equal(parsed.offers.availability, "https://schema.org/InStock");
  assert.equal(parsed.offers.seller["@type"], "Person");
  assert.equal(parsed.aggregateRating, undefined);
  assert.equal(parsed.brand, undefined);
  assert.equal(parsed.gtin, undefined);
});

test("metadata, robots and sitemap cover public discovery without private routes", () => {
  const product = read("app", "product", "[id]", "page.tsx");
  const store = read("app", "store", "[slug]", "page.tsx");
  const info = read("app", "info", "[slug]", "page.tsx");
  const robots = read("app", "robots.ts");
  const sitemap = read("app", "sitemap.ts");
  for (const source of [product, store, info]) assert.match(source, /generateMetadata/);
  assert.match(robots, /"\/\*\/dashboard"/);
  assert.match(robots, /"\/\*\/search"/);
  assert.match(sitemap, /SITEMAP_ENTITY_LIMIT = 1_000/);
  assert.match(sitemap, /status: "PUBLISHED"/);
  assert.doesNotMatch(sitemap, /dashboard|checkout|messages|favorites/);
});
