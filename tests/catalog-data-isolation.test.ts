import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { catalogNameIssue } from "../lib/catalog-content-quality";
import { isLikelyTestLabel } from "../lib/catalog-data-management";
import { publicProductAccessWhere, publicStoreAccessWhere } from "../lib/admin-access";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("public product and store policy explicitly excludes TEST_DEMO catalog data", () => {
  assert.equal(publicStoreAccessWhere().dataClass, "PRODUCTION");
  assert.equal(publicProductAccessWhere().dataClass, "PRODUCTION");
  assert.equal(publicProductAccessWhere().removedAt, null);
});

test("homepage, search, directory, product detail and public counts share production visibility", () => {
  assert.match(source("app/page.tsx"), /publicProductAccessWhere/);
  assert.match(source("app/page.tsx"), /products:\s*\{\s*some:\s*\{\s*status:\s*"PUBLISHED",\s*dataClass:\s*"PRODUCTION"/);
  assert.match(source("app/api/marketplace/products/route.ts"), /publicProductAccessWhere/);
  assert.match(source("app/product/[id]/page.tsx"), /publicProductAccessWhere/);
  assert.match(source("app/store/page.tsx"), /publicStoreAccessWhere/);
  assert.match(source("app/store/page.tsx"), /dataClass:\s*"PRODUCTION"/);
  assert.match(source("app/sitemap.xml/route.ts"), /dataClass:\s*"PRODUCTION"/);
});

test("publication quality rejects only obvious placeholders and garbage", () => {
  for (const value of ["test", "test123", "demo-9", "aaaa", "___"]) assert.ok(catalogNameIssue(value));
  for (const value of ["کڵاوی کوردی", "متجر الورد", "Atelier Élise", "A&B", "پۆشاک ٢٤"]) assert.equal(catalogNameIssue(value), null);
});

test("CJ edit path is exempt from local placeholder-name publication guard", () => {
  const route = source("app/api/products/[id]/route.ts");
  assert.match(route, /product\.supplierLink\?\.provider !== "CJ"/);
  assert.match(source("app/api/products/route.ts"), /status === "PUBLISHED"/);
});

test("admin catalog hints never automatically classify by name", () => {
  assert.equal(isLikelyTestLabel("test55"), true);
  assert.equal(isLikelyTestLabel("Contest Boutique"), false);
  const service = source("lib/catalog-data-management.ts");
  assert.doesNotMatch(service.slice(service.indexOf("classifyCatalogData")), /isLikelyTestLabel/);
  assert.match(source("app/api/admin/catalog-data/route.ts"), /confirmed !== true/);
  assert.match(service, /requireAdmin/);
  assert.match(service, /accountSecurityEvent\.create/);
});

test("historical catalog evidence remains protected and removal architecture is reused", () => {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model OrderItem[\s\S]*product Product @relation\([^\n]*onDelete: Restrict/);
  assert.match(schema, /stripePaymentIntentId/);
  assert.match(schema, /paymentMode String\?/);
  assert.match(schema, /model RefundOperation/);
  assert.match(schema, /model InventoryRestockEvent/);
  assert.match(source("app/adm-barewbar-182203/catalog-data/page.tsx"), /AdminProductRemovalAction/);
});
