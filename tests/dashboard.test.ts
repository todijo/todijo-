import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("dashboard actions remain localized and avoid unavailable buyer placeholders", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsList = readFileSync("app/seller/products/SellerProductsList.tsx", "utf8");

  assert.match(ui, /notificationHref: string/);
  assert.match(ui, /href=\{notificationHref\}/);
  assert.match(dashboardPage, /notificationHref=\{`\/\$\{locale\}\/notifications`\}/);
  assert.doesNotMatch(dashboardPage, /dashboard#favorites|dashboard#addresses|dashboard#payments/);
  assert.match(dashboardPage, /label: common\("cart"\), href: paths\.cart/);
  assert.match(productsList, /`\/\$\{locale\}\/seller\/products\/\$\{product\.id\}\/edit`/);
  assert.match(productsList, /`\/\$\{locale\}\/product\/\$\{product\.id\}`/);
});

test("seller product actions keep the subscription and team capability gates", () => {
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsPage = readFileSync("app/seller/products/page.tsx", "utf8");

  assert.match(dashboardPage, /sellerCanAddProduct\s*=\s*Boolean\(activeStore\s*&&\s*canCreateProducts\s*&&\s*canPublish\(activeStore,new Date\(\),selectedCommercialPlan\)\)/);
  assert.match(dashboardPage, /sellerCanAddProduct&&<DashboardQuickAction[^>]+seller\/products\/new/);
  assert.match(dashboardPage, /owner&&!subscriptionActive&&<DashboardQuickAction label=\{readinessAction\} href=\{readinessHref\}/);
  assert.match(dashboardPage, /readinessUsesSettings\?Settings:CreditCard/);
  assert.match(productsPage, /const canAddProduct = subscriptionActive && !quota.blocked/);
  assert.match(productsPage, /href=\{canAddProduct\s*\?\s*`\/\$\{locale\}\/seller\/products\/new\?store=\$\{store\.id\}`\s*:\s*readinessHref\}/);
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

test("dashboard database-backed readiness and principal lookups resolve through the controlled timeout boundary", () => {
  const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
  assert.match(dashboard, /const DASHBOARD_DATA_TIMEOUT_MS = 15_000/);
  assert.match(dashboard, /dashboardData\(Promise\.all\(\[sellerStoreChoices\(prisma,session\.userId\),sellerPrincipals\(prisma,session\.userId\)\]\)\)/);
  assert.match(dashboard, /dashboardData\(prisma\.store\.findUnique\(/);
  assert.match(dashboard, /dashboardData\(sellerBusinessCommercialPlan\(/);
  assert.match(dashboard, /dashboardData\(prisma\.sellerBenefitAccess\.findUnique\(/);
  assert.match(readFileSync("app/dashboard/error.tsx", "utf8"), /onClick=\{reset\}/);
});

test("dashboard session loading is time-bounded and visibility changes no longer trigger surprise refreshes", () => {
  const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
  const verificationNotice = readFileSync("components/EmailVerificationNotice.tsx", "utf8");
  assert.match(dashboard, /dashboardData\(readSession\(\)\)/);
  assert.doesNotMatch(verificationNotice, /visibilitychange|addEventListener\("focus"/);
  assert.match(verificationNotice, /router\.refresh\(\)/);
  assert.doesNotMatch(readFileSync("app/dashboard/loading.tsx", "utf8"), /router\.refresh|location\.reload|setInterval/);
});

test("seller product titles keep semantic foreground contrast on light cards", () => {
  const page = readFileSync("app/seller/products/SellerProductsList.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(page, /className="sellerProductCard"[\s\S]*?<h2>\{product\.name\}<\/h2>/);
  assert.match(page, /product\.status\s*===\s*"PUBLISHED"[\s\S]*?statusDraft/);
  assert.match(css, /--ink:\s*#21163a/);
  assert.match(css, /\.sellerProductsGridPremium \.sellerProductCard\{color:var\(--ink\)\}/);
});


test("dashboard links do not prefetch rewritten dashboard routes", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const marketplaceHeader = readFileSync("components/MarketplaceHeader.tsx", "utf8");
  const siteHeader = readFileSync("components/SiteHeader.tsx", "utf8");
  assert.match(ui, /prefetch=\{href\.includes\("\/dashboard"\) \? false : undefined\}/);
  assert.match(marketplaceHeader, /prefetch=\{accountName \? false : undefined\}/);
  assert.match(siteHeader, /prefetch=\{accountName \? false : undefined\}/);
});


test("localized dashboard bypasses middleware rewrite and reuses the canonical dashboard implementation", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  const localizedPage = readFileSync("app/[locale]/dashboard/page.tsx", "utf8");
  const localizedLoading = readFileSync("app/[locale]/dashboard/loading.tsx", "utf8");
  const localizedError = readFileSync("app/[locale]/dashboard/error.tsx", "utf8");
  assert.match(middleware, /isLocalizedDashboard = segments\.length === 2 && segments\[1\] === "dashboard"/);
  assert.match(middleware, /isLocalizedDashboard \|\| isLocalizedConnectCallback/);
  assert.match(localizedPage, /export \{ dynamic, default \} from "\.\.\/\.\.\/dashboard\/page"/);
  assert.match(localizedLoading, /export \{ default \} from "\.\.\/\.\.\/dashboard\/loading"/);
  assert.match(localizedError, /"use client"/);
});
