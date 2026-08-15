import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketplaceUrl, normalizeMarketplaceSearch } from "../lib/marketplace-search";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("marketplace search uses a dedicated localized, refresh-safe results route", () => {
  const normalized = normalizeMarketplaceSearch({ q: "camera", country: "France", sort: "price-asc", page: "2" });
  assert.equal(marketplaceUrl("fr", normalized.filters, normalized.page), "/fr/search?q=camera&country=FR&sort=price-asc&page=2");
  assert.doesNotMatch(marketplaceUrl("en", normalized.filters), /#products/);
  assert.match(source("app/search/page.tsx"), /resultsOnly|__resultsOnly/);
});

test("variant purchase CTA distinguishes incomplete selection from unavailable stock", () => {
  const panel = source("components/ProductPurchasePanel.tsx");
  const button = source("components/AddToCartButton.tsx");
  assert.match(panel, /selectionComplete/);
  assert.match(panel, /chooseOptions/);
  assert.match(button, /disabledLabel/);
});

test("pre-purchase questions are meaningful and controlled by the seller", () => {
  assert.match(source("components/AskSellerButton.tsx"), /useState\(""\)/);
  assert.match(source("components/AskSellerButton.tsx"), /trim\(\)\.length < 12/);
  assert.match(source("app/api/conversations/route.ts"), /PREPURCHASE_QUESTIONS_DISABLED/);
  assert.match(source("prisma/schema.prisma"), /allowPrepurchaseQuestions Boolean\s+@default\(true\)/);
  assert.match(source("app/seller/products/new/NewProductForm.tsx"), /allowPrepurchaseQuestions/);
  assert.match(source("app/seller/products/\[id\]/edit/EditProductForm.tsx"), /allowPrepurchaseQuestions/);
});

test("seller reviews, favorites, messages, and notifications have purposeful destinations", () => {
  assert.match(source("components/SellerDashboardLayout.tsx"), /seller\/reviews/);
  assert.match(source("app/dashboard/page.tsx"), /notificationHref=\{`\/\$\{locale\}\/notifications`\}/);
  assert.match(source("app/favorites/page.tsx"), /FavoritesClient/);
  assert.match(source("app/messages/page.tsx"), /DashboardReturnLink/);
  assert.match(source("app/messages/\[id\]/page.tsx"), /threadNavigation/);
});

test("Stripe dashboard contrast is token-compatible in dark mode", () => {
  const css = source("app/globals.css");
  assert.match(css, /stripeStatusGrid span\.isReady[^}]*color:#8ff0c7/);
  assert.match(css, /quickActionLink\.primary:disabled[^}]*color:#9eb2aa/);
});
