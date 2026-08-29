import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Stripe readiness is unified with every existing admin action", () => {
  const page = readFileSync("app/adm-barewbar-182203/page.tsx", "utf8");
  assert.match(page, /<nav className="adminHeroActions"/);
  for (const route of ["connect-readiness", "products", "catalog-data", "content", "support", "suppliers", "moderation", "orders", "users", "buyers", "sellers"]) assert.match(page, new RegExp(`adm-barewbar-182203/${route}`));
  assert.equal((page.match(/connect-readiness/g) ?? []).length, 1);
});

test("admin access presentation preserves API methods and dropshipping behavior", () => {
  const dashboard = readFileSync("app/adm-barewbar-182203/AdminDashboard.tsx", "utf8");
  assert.match(dashboard, /adminAccessPanel/);
  assert.match(dashboard, /adminDropshippingAction/);
  assert.match(dashboard, /request\("PATCH", \{ storeIds: selected, months:/);
  assert.match(dashboard, /api\/admin\/dropshipping\/\$\{storeId\}/);
  assert.match(dashboard, /body: JSON\.stringify\(\{ enabled \}\)/);
});

test("desktop categories are click controlled with outside and Escape dismissal", () => {
  const menu = readFileSync("components/MarketplaceCategoryNavigation.tsx", "utf8");
  assert.doesNotMatch(menu, /onMouseEnter|onMouseLeave/);
  assert.match(menu, /onClick=\{\(\) => toggleCategory\(category\.id\)\}/);
  assert.match(menu, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /aria-controls="market-category-mega-menu"/);
  assert.match(menu, /categorySearchHref\(locale, value\)/);
  assert.match(readFileSync("components/BuyerMobileNavigation.tsx", "utf8"), /categorySearchHref\(locale, activeCategory\.label\)/);
});

test("CJ import feedback is immediate, localized and duplicate-safe without API changes", () => {
  const ui = readFileSync("components/SupplierCatalogWorkspace.tsx", "utf8");
  assert.match(ui, /if\(importing\|\|busy\)return/);
  assert.match(ui, /setImporting\(true\)[\s\S]*setBusy\(true\)/);
  assert.match(ui, /disabled=\{busy\|\|previewBusy\|\|importing\}/);
  assert.match(ui, /role="status" aria-live="assertive"/);
  assert.match(ui, /role=\{importFailed\?"alert":"status"\}/);
  const copy = readFileSync("i18n/supplier-bulk.ts", "utf8");
  for (const value of ["Import in progress", "Importation en cours", "الاستيراد جارٍ"]) assert.match(copy, new RegExp(value));
  assert.match(readFileSync("lib/suppliers/supplier-catalog-policy.ts", "utf8"), /rate|limit/i);
});

test("responsive styles cover action wrapping, styled controls, status text and RTL", () => {
  const css = readFileSync("app/globals.css", "utf8");
  for (const token of [".adminHeroActions", ".adminDropshippingAction", ".supplierImportProgress", ".supplierImportError", "max-width:560px", '[dir="rtl"] .adminHeroActions']) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
