import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const cartLinkSource = readFileSync(join(root, "components", "CartLink.tsx"), "utf8");
const homeSource = readFileSync(join(root, "app", "HomeClient.tsx"), "utf8");
const mobileNavigation = readFileSync(join(root, "components", "BuyerMobileNavigation.tsx"), "utf8");
const mobileHeader = readFileSync(join(root, "components", "BuyerMobileHeader.tsx"), "utf8");
const cardAction = readFileSync(join(root, "components", "ProductCardAction.tsx"), "utf8");
const styles = readFileSync(join(root, "app", "globals.css"), "utf8");

test("mobile header has a direct cart link, menu trigger, and second-row search", () => {
  assert.match(cartLinkSource, /<Link className=\{className\} href="\/cart"/);
  assert.match(cartLinkSource, /<ShoppingCart className="cartLinkIcon"/);
  assert.match(homeSource, /<BuyerMobileHeader accountName=\{accountName\}\/>/);
  assert.match(mobileHeader, /className="buyerMobileShellSearch"/);
  assert.match(mobileHeader, /className="buyerMobileShellCart"/);
  assert.match(styles, /\.buyerMobileShellTop\{[^}]*grid-template-columns:auto minmax\(0,1fr\) 44px/);
  assert.match(styles, /\.buyerMobileShellHeader\{position:sticky;z-index:1000;top:0/);
  assert.match(styles, /safe-area-inset-top/);
});

test("mobile drawer supports explicit, backdrop, and keyboard closing with focus return", () => {
  assert.match(mobileNavigation, /className="buyerMobileMenuButton"/);
  assert.match(mobileNavigation, /className="buyerMobileDrawerBackdrop"[^>]*onClick=\{closeDrawer\}/);
  assert.match(mobileNavigation, /event\.key === "Escape"/);
  assert.match(mobileNavigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(mobileNavigation, /triggerRef\.current\?\.focus\(\)/);
  assert.match(mobileNavigation, /event\.key !== "Tab"/);
  assert.match(styles, /\.buyerMobileMenuButton\{width:44px;height:44px/);
});

test("buyer bottom navigation is mobile-only with active state and safe-area clearance", () => {
  assert.match(styles, /\.buyerMobileMenuButton,\.buyerMobileBottomNav\{display:none\}/);
  assert.match(styles, /\.buyerMobileBottomNav\{position:fixed;[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /body:has\(\.buyerMobileBottomNav\)\{padding-bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\)\}/);
  assert.match(mobileNavigation, /aria-current=\{isHome \? "page" : undefined\}/);
  assert.match(mobileNavigation, /totalItems > 0/);
});

test("mobile categories and product grids stay contained in two columns", () => {
  assert.match(styles, /\.categoryStrip\{width:100%;gap:6px;[^}]*scroll-snap-type:x mandatory/);
  assert.match(styles, /\.categoryStrip\{gap:4px\}/);
  assert.match(styles, /\.marketplaceProductRail\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.discoveryProductGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.discoveryCardBody h3\{display:-webkit-box;[^}]*-webkit-line-clamp:2/);
  assert.match(styles, /\.marketplaceProductRail\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("mobile product cards are compact with prominent images and accessible actions", () => {
  assert.match(styles, /\.discoveryImageWrap\{aspect-ratio:4\/5\}/);
  assert.match(styles, /\.marketplaceProductRail \.discoveryCardBody\{display:block;padding:4px\}/);
  assert.match(styles, /\.marketplaceProductRail \.discoveryCardBody h3\{margin:1px 0 2px\}/);
  assert.match(styles, /\.discoveryCard\{align-self:start\}/);
  assert.match(styles, /\.discoveryCardBody\{display:block;flex:none;padding:4px\}/);
  assert.doesNotMatch(styles, /\.discoveryCardBody\{[^}]*justify-content:space-between/);
  assert.match(styles, /\.discoveryCardBody h3\{min-height:0;max-height:none;margin:1px 0 2px;[^}]*line-height:1\.15\}/);
  assert.match(styles, /\.productAvailability\{display:none\}/);
  assert.match(styles, /\.discoveryCardBody \.cardBottom\{margin-top:0\}/);
  assert.match(styles, /\.cardBottom\{padding-top:0\}/);
  assert.match(styles, /\.cardCartButton\{min-height:44px;margin-top:3px/);
  assert.match(styles, /\.cardWishlist\{width:44px;height:44px;border:0;background:transparent/);
  assert.match(styles, /\.cardWishlist::before\{content:"";[^}]*inset:3px/);
});

test("product-card actions preserve variant, legacy, and sold-out behavior", () => {
  assert.match(cardAction, /action === "CHOOSE_OPTIONS"/);
  assert.match(cardAction, /className=\{`\$\{classes\} cardChooseOptionsButton`\}/);
  assert.match(cardAction, /action === "SOLD_OUT"/);
  assert.match(cardAction, /onClick=\{\(\) => addItem\(\{ \.\.\.product, stock \}\)\}/);
});

test("HomeHeader translation files keep key parity", () => {
  const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl"];
  const keys = locales.map((locale) => Object.keys(JSON.parse(readFileSync(join(root, "messages", "home-header", `${locale}.json`), "utf8"))).sort());
  keys.slice(1).forEach((localized) => assert.deepEqual(localized, keys[0]));
});
