import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const messages = ["en", "fr", "de", "es", "it", "nl", "pt", "tr", "ru", "ar", "fa", "hi", "zh", "ku"].map((locale) => JSON.parse(readFileSync(`messages/dashboard-premium/${locale}.json`, "utf8")));

test("dashboard actions remain localized and avoid unavailable buyer placeholders", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsPage = readFileSync("app/seller/products/page.tsx", "utf8");

  assert.match(ui, /notificationHref: string/);
  assert.match(ui, /href=\{notificationHref\}/);
  assert.match(dashboardPage, /notificationHref=\{`\/\$\{locale\}\/notifications`\}/);
  assert.doesNotMatch(dashboardPage, /dashboard#favorites|dashboard#addresses|dashboard#payments/);
  assert.match(dashboardPage, /label: common\("cart"\), href: paths\.cart/);
  assert.match(productsPage, /`\/\$\{locale\}\/seller\/products\/\$\{product\.id\}\/edit`/);
  assert.match(productsPage, /`\/\$\{locale\}\/product\/\$\{product\.id\}`/);
});

test("seller product actions keep the existing subscription gate", () => {
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsPage = readFileSync("app/seller/products/page.tsx", "utf8");

  assert.match(dashboardPage, /subscriptionActive\s*\?\s*<DashboardQuickAction[^>]+seller\/products\/new/);
  assert.match(dashboardPage, /subscriptionActive\s*\?\s*<DashboardQuickAction[^>]+seller\/products\/new[^:]+:\s*<DashboardQuickAction label=\{readinessAction\} href=\{readinessHref\}/);
  assert.match(productsPage, /href=\{subscriptionActive\s*\?\s*`\/\$\{locale\}\/seller\/products\/new`\s*:\s*readinessHref\}/);
  assert.doesNotMatch(dashboardPage, /Status: \{user\.store\.subscription/);
  assert.doesNotMatch(productsPage, /store\.subscription\?\.status \?\? "NOT_STARTED"/);
});

test("dashboard polish preserves semantic loading and mobile touch targets", () => {
  const loading = readFileSync("app/dashboard/loading.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(loading, /role="status"[^>]+aria-live="polite"[^>]+aria-busy="true"/);
  assert.match(readFileSync("app/dashboard/page.tsx", "utf8"), /<DashboardEmptyState headingLevel="h1" title=\{t\("openShop"\)\}/);
  assert.match(css, /sellerProductActions a,\.sellerProductActions span\{min-height:44px/);
  assert.match(css, /premiumMobileDrawer\{left:auto;inset-inline-start:12px/);
  assert.match(css, /premiumDashboardMobileNav a span\{max-width:64px;[^}]*white-space:normal/);
});

test("seller product titles keep semantic foreground contrast on light cards", () => {
  const page = readFileSync("app/seller/products/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(page, /className="sellerProductCard"[\s\S]*?<h2>\{product\.name\}<\/h2>/);
  assert.match(page, /product\.status\s*===\s*"PUBLISHED"[\s\S]*?statusDraft/);
  assert.match(css, /--ink:\s*#21163a/);
  assert.match(css, /\.sellerProductsGridPremium \.sellerProductCard\{color:var\(--ink\)\}/);
});
