import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("bulk CJ import is automatic, sequential, capped, and draft-only",()=>{
  const component=readFileSync("components/SupplierProductManager.tsx","utf8");
  const bulkRoute=readFileSync("app/api/admin/supplier-products/bulk-import/route.ts","utf8");
  const importer=readFileSync("lib/suppliers/supplier-products.ts","utf8");
  assert.match(component,/api\/admin\/supplier-products\/bulk-import/);
  assert.match(bulkRoute,/const MAX_BATCH_SIZE = 200/);
  assert.match(bulkRoute,/batch\.length > MAX_BATCH_SIZE/);
  assert.match(bulkRoute,/new Set\(value\.split/);
  assert.match(bulkRoute,/for \(const \[index, supplierProductId\] of batch\.entries\(\)\)/);
  assert.match(bulkRoute,/sellingPrice: null/);
  assert.doesNotMatch(bulkRoute,/Promise\.all|Promise\.allSettled/);
  assert.match(importer,/status:"DRAFT"/);
});

test("bulk importer never silently publishes or accepts client FX",()=>{
  const component=readFileSync("components/SupplierProductManager.tsx","utf8");
  const route=readFileSync("app/api/supplier/cj/import/route.ts","utf8");
  const bulkRoute=readFileSync("app/api/admin/supplier-products/bulk-import/route.ts","utf8");
  assert.doesNotMatch(component,/status:\s*"PUBLISHED"/);
  assert.doesNotMatch(bulkRoute,/exchangeRate|fxRate|supplierCost|shippingCost|targetMargin|sellingPrice:\s*body/);
  assert.doesNotMatch(route,/exchangeRate|fxRate/);
});

test("bulk route normalizes input, rejects empty and over-limit batches, and isolates item results",()=>{
  const route=readFileSync("app/api/admin/supplier-products/bulk-import/route.ts","utf8");
  assert.match(route,/split\(\/\[\\s,;\]\+\//);
  assert.match(route,/!batch\.length \|\| !category/);
  assert.match(route,/SUPPLIER_BULK_LIMIT_EXCEEDED/);
  assert.match(route,/already_imported/);assert.match(route,/status: "invalid"/);assert.match(route,/status: "failed"/);
  assert.match(route,/catch \(error\)[\s\S]+results\.push/);
});

test("automatic sync endpoint is server-secret protected and platform CJ scoped",()=>{
  const route=readFileSync("app/api/internal/supplier-sync/route.ts","utf8");
  const helper=readFileSync("lib/suppliers/automatic-sync.ts","utf8");
  assert.match(route,/SUPPLIER_SYNC_CRON_SECRET/);
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/status: 401/);
  assert.match(helper,/ownerType: "PLATFORM"/);
  assert.match(helper,/connectionId: PLATFORM_CJ_CONNECTION_ID/);
  assert.match(helper,/DEFAULT_STALE_MINUTES = 360/);
  assert.match(helper,/MAX_BATCH_SIZE = 20/);
  assert.match(helper,/take: limit/);
  assert.match(helper,/CJ_INTER_PRODUCT_DELAY_MS = 1100/);
});

test("manual sync-all remains admin protected",()=>{
  const route=readFileSync("app/api/admin/supplier-products/sync-stale/route.ts","utf8");
  assert.match(route,/requirePlatformSupplierAdmin/);
  assert.match(route,/syncStalePlatformCjProducts/);
});

test("cron secret is documented without a value",()=>{
  const example=readFileSync(".env.example","utf8");
  assert.match(example,/SUPPLIER_SYNC_CRON_SECRET=\s*$/m);
});
