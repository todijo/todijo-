import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales } from "../i18n/config";
import { parseSitemapPartition, SITEMAP_ENTITY_CHUNK_SIZE, sitemapPartitionDescriptors } from "../lib/sitemap-partitions";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("catalogs larger than one thousand entities are represented across bounded partitions", () => {
  const partitions = sitemapPartitionDescriptors(3_201, 2_201);
  assert.deepEqual(partitions.filter(({ kind }) => kind === "products").map(({ id }) => id), ["products-0", "products-1", "products-2"]);
  assert.deepEqual(partitions.filter(({ kind }) => kind === "stores").map(({ id }) => id), ["stores-0", "stores-1"]);
  assert.equal(SITEMAP_ENTITY_CHUNK_SIZE, 1_500);
  assert.ok(SITEMAP_ENTITY_CHUNK_SIZE * locales.length < 50_000);
});

test("partition identifiers are unique, stable and parseable", () => {
  const partitions = sitemapPartitionDescriptors(4_500, 4_500);
  assert.equal(new Set(partitions.map(({ id }) => id)).size, partitions.length);
  for (const partition of partitions) assert.deepEqual(parseSitemapPartition(partition.id), partition);
  assert.equal(parseSitemapPartition("products-invalid"), null);
  assert.equal(parseSitemapPartition(undefined), null);
});

test("partition routes use bounded stable queries and preserve sitemap exclusions", () => {
  const sitemap = read("app", "sitemap.ts");
  const robots = read("app", "robots.ts");
  assert.match(sitemap, /take: SITEMAP_ENTITY_CHUNK_SIZE/);
  assert.match(sitemap, /skip, take: SITEMAP_ENTITY_CHUNK_SIZE/);
  assert.match(sitemap, /orderBy: \[\{ createdAt: "asc" \}, \{ id: "asc" \}\]/);
  assert.match(sitemap, /status: "PUBLISHED"/);
  assert.match(sitemap, /publicProductAccessWhere/);
  assert.match(sitemap, /publicStoreAccessWhere/);
  assert.doesNotMatch(sitemap, /localizedEntries\(`?(dashboard|account|messages|cart|checkout|admin)/);
  assert.match(robots, /\/sitemap\/\$\{id\}\.xml/);
});
