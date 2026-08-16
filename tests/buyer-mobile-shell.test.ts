import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const header = read("components/BuyerMobileHeader.tsx");
const navigation = read("components/BuyerMobileNavigation.tsx");
const siteHeader = read("components/SiteHeader.tsx");
const marketplaceHeader = read("components/MarketplaceHeader.tsx");
const product = read("app/product/[id]/page.tsx");
const store = read("app/store/[slug]/page.tsx");
const css = read("app/globals.css");

test("buyer routes share one mobile header with menu, logo, cart, and search", () => {
  assert.match(header, /<BuyerMobileNavigation accountName=\{accountName\}/);
  assert.match(header, /<TodijoLogo href=\{homeHref\} inverse/);
  assert.match(header, /<CartLink label=\{common\("cart"\)\} className="buyerMobileShellCart"/);
  assert.match(header, /className="buyerMobileShellSearch" role="search"/);
  assert.match(marketplaceHeader, /<BuyerMobileHeader accountName=\{accountName\}\/>/);
  assert.doesNotMatch(marketplaceHeader, /<BuyerMobileNavigation accountName=/);
  assert.match(siteHeader, /return <MarketplaceHeader showFilterDock\/>/);
  assert.match(store, /<SiteHeader storeName=\{store\.name\}/);
  assert.match(product, /<SiteHeader storeName=/);
});

test("shared drawer and live bottom navigation remain accessible across routes", () => {
  assert.match(navigation, /className="buyerMobileMenuButton"/);
  assert.match(navigation, /className="buyerMobileDrawerBackdrop"[^>]*onClick=\{closeDrawer\}/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /event\.key !== "Tab"/);
  assert.match(navigation, /triggerRef\.current\?\.focus\(\)/);
  assert.match(navigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(navigation, /totalItems > 0/);
  assert.match(navigation, /showBottomNavigation = !currentPath\.startsWith\("\/checkout"\)/);
  assert.match(navigation, /className="buyerMobileCategoriesButton"/);
  assert.match(navigation, /DESKTOP_CATEGORY_TAXONOMY\.map/);
  assert.match(navigation, /buyerMobileCategoryBrowser/);
});

test("shared mobile header shows locale-safe Back navigation only away from Home", () => {
  assert.match(header, /const isRootHome = pathWithoutLocale\(pathname\) === "\/"/);
  assert.match(header, /const showBack = !isRootHome \|\| Boolean\(homeLocationSuffix\)/);
  assert.match(header, /className="buyerMobileBackButton"[^>]*onClick=\{goBack\}[^>]*aria-label=\{common\("back"\)\}/);
  assert.match(header, /window\.history\.length > 1 && sameOriginReferrer/);
  assert.match(header, /else router\.push\(navigationBackFallback\(pathname, locale\)\)/);
  assert.match(header, /<BuyerMobileNavigation accountName=\{accountName\}\/>/);
});

test("mobile shell offsets content and preserves desktop headers", () => {
  assert.match(css, /\.buyerMobileShellHeader\{display:none\}/);
  assert.match(css, /@media\(max-width:860px\)[\s\S]*?\.buyerMobileShellHeader\{position:sticky;z-index:1000;top:0/);
  assert.match(css, /\.buyerMobileShellTop\{[^}]*grid-template-columns:auto minmax\(0,1fr\) 44px/);
  assert.match(css, /\.buyerMobileBackButton\{width:44px;height:44px/);
  assert.match(css, /body:has\(\.buyerMobileBottomNav\)\{padding-bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\)\}/);
  assert.match(css, /\.buyerMobileShellHeader~\.marketHeader,\.buyerMobileShellHeader~\.siteHeader,\.buyerMobileShellHeader~\.premiumStoreHeader\{display:none\}/);
  assert.match(css, /\.productLightbox\{z-index:9999\}/);
});

test("Product Detail gallery and purchase action fit around persistent navigation", () => {
  assert.match(css, /\.productMobileImageTrack\{[^}]*width:100%;aspect-ratio:4\/5/);
  assert.match(css, /\.productMobileImageSlide img\{[^}]*width:100%;height:100%;[^}]*object-fit:cover;object-position:center/);
  assert.match(css, /\.mobilePurchaseBar\{bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\);padding-bottom:9px\}/);
  assert.match(css, /\.productDetailPage\{padding-bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)\}/);
  assert.match(css, /\.productGalleryBack\{display:none!important\}/);
  assert.match(css, /body:has\(\.buyerMobileShellHeader\)\{overflow-x:clip\}/);
});
