import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dashboardAudience, dashboardPaths } from "../lib/dashboard";

test("dashboard links preserve the active locale", () => {
  assert.deepEqual(dashboardPaths("fr"), { home: "/fr", dashboard: "/fr/dashboard", orders: "/fr/account/orders", messages: "/fr/messages", cart: "/fr/cart" });
});

test("dashboard audience keeps customers in buyer UI and privileged store roles in seller UI", () => {
  assert.equal(dashboardAudience("CUSTOMER"), "buyer");
  assert.equal(dashboardAudience("SELLER"), "seller");
  assert.equal(dashboardAudience("ADMIN"), "seller");
});

test("mobile buyer and seller dashboards expose one localized Todijo Home logo", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const sellerLayout = readFileSync("components/SellerDashboardLayout.tsx", "utf8");
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(ui, /premiumDashboardHeader[^;]*><TodijoLogo href=\{homeHref\}/);
  assert.match(sellerLayout, /homeHref=\{`\/\$\{locale\}`\}/);
  assert.match(dashboardPage, /const homeHref = paths\.home/);
  assert.match(dashboardPage, /<DashboardHeader[^>]*homeHref=\{homeHref\}/);
  assert.match(css, /premiumDashboardHeader>\.todijoBrand\{display:none\}/);
  assert.match(css, /@media\(max-width:780px\)[\s\S]*premiumDashboardHeader>\.todijoBrand\{min-width:44px;min-height:44px;display:inline-flex\}/);
  assert.match(css, /premiumDashboardHeader\{position:sticky;z-index:70;top:0\}/);
});

test("seller onboarding keeps Home and redirects inside the active locale", () => {
  const createStorePage = readFileSync("app/seller/create-store/page.tsx", "utf8");
  const createStoreForm = readFileSync("app/seller/create-store/CreateStoreForm.tsx", "utf8");
  const subscriptionPage = readFileSync("app/seller/subscription/page.tsx", "utf8");

  assert.match(createStorePage, /href=\{`\/\$\{locale\}`\}/);
  assert.match(createStorePage, /redirect\(`\/\$\{locale\}\/login`\)/);
  assert.match(createStorePage, /redirect\(`\/\$\{locale\}\/dashboard`\)/);
  assert.match(createStoreForm, /router\.push\(`\/\$\{locale\}\/seller\/subscription`\)/);
  assert.match(subscriptionPage, /href=\{`\/\$\{locale\}\/dashboard`\}/);
  assert.match(subscriptionPage, /redirect\(`\/\$\{locale\}\/seller\/create-store`\)/);
});

test("seller mobile drawer adds the authorized localized product-create destination without changing desktop items", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const sellerLayout = readFileSync("components/SellerDashboardLayout.tsx", "utf8");
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");

  assert.match(sellerLayout, /const mobileMenuItems = canAddProduct/);
  assert.match(sellerLayout, /href: `\/\$\{locale\}\/seller\/products\/new`/);
  assert.match(sellerLayout, /icon: Plus, active: active === "new-product"/);
  assert.match(ui, /premiumMobileDrawer[\s\S]*mobileMenuItems\.map/);
  assert.match(ui, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(ui, /premiumDashboardMobileNav[\s\S]*items\.slice\(0, 5\)/);
  assert.match(dashboardPage, /sellerCanAddProduct = Boolean\(user\.store && canPublish\(user\.store\)\)/);
});

test("DashboardPremium translations keep Add Product parity and exact English and French labels", () => {
  const locales = ["ar", "de", "en", "es", "fr", "it", "ku", "nl", "tr"];
  const messages = locales.map((locale) => JSON.parse(readFileSync(`messages/dashboard-premium/${locale}.json`, "utf8")));
  const expectedNavKeys = Object.keys(messages[2].nav).sort();

  for (const message of messages) {
    assert.deepEqual(Object.keys(message.nav).sort(), expectedNavKeys);
    assert.equal(typeof message.nav.addProduct, "string");
    assert.ok(message.nav.addProduct.length > 0);
  }
  assert.equal(messages[2].nav.addProduct, "Add a product");
  assert.equal(messages[4].nav.addProduct, "Ajouter un produit");
});

test("dashboard actions remain localized and avoid unavailable buyer placeholders", () => {
  const ui = readFileSync("components/DashboardUI.tsx", "utf8");
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsPage = readFileSync("app/seller/products/page.tsx", "utf8");

  assert.match(ui, /notificationHref: string/);
  assert.match(ui, /href=\{notificationHref\}/);
  assert.match(dashboardPage, /notificationHref=\{`\/\$\{locale\}\/seller\/store-settings#notifications`\}/);
  assert.doesNotMatch(dashboardPage, /dashboard#favorites|dashboard#addresses|dashboard#payments/);
  assert.match(dashboardPage, /label: common\("cart"\), href: paths\.cart/);
  assert.match(productsPage, /`\/\$\{locale\}\/seller\/products\/\$\{product\.id\}\/edit`/);
  assert.match(productsPage, /`\/\$\{locale\}\/product\/\$\{product\.id\}`/);
});

test("seller product actions keep the existing subscription gate", () => {
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const productsPage = readFileSync("app/seller/products/page.tsx", "utf8");

  assert.match(dashboardPage, /subscriptionActive \? <DashboardQuickAction[^>]+seller\/products\/new/);
  assert.match(dashboardPage, /<DashboardQuickAction label=\{control\("viewPlans"\)\} href=\{`\/\$\{locale\}\/seller\/subscription`\}/);
  assert.match(productsPage, /href=\{subscriptionActive \? `\/\$\{locale\}\/seller\/products\/new` : `\/\$\{locale\}\/seller\/subscription`\}/);
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
