import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("supplier worker and admin catalog endpoints never return arbitrary provider errors", () => {
  const worker = source("app/api/internal/supplier-sync/route.ts");
  const catalog = source("app/api/admin/supplier-products/catalog-search/route.ts");
  assert.match(worker, /error: "SUPPLIER_SYNC_FAILED"/);
  assert.doesNotMatch(worker, /error: error instanceof Error \? error\.message/);
  assert.match(catalog, /error\.message\s*===\s*"CJ_CATALOG_SEARCH_INPUT_INVALID"/);
  assert.match(catalog, /error:\s*"SUPPLIER_CATALOG_SEARCH_FAILED"/);
  assert.doesNotMatch(catalog, /const code=error instanceof Error\?error\.message/);
});

test("mobile admin dashboard counts active stores in the database without loading all grants", () => {
  const dashboard = source("app/api/mobile/admin/dashboard/route.ts");
  const access = source("lib/admin-access.ts");
  assert.match(dashboard, /prisma\.store\.count\(\{ where: storeActiveAccessWhere\(now\) \}\)/);
  assert.doesNotMatch(dashboard, /prisma\.store\.findMany/);
  assert.match(access, /export function storeActiveAccessWhere/);
  assert.match(access, /\.\.\.storeActiveAccessWhere\(now\)/);
});
