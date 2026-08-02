import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const cartLinkSource = readFileSync(join(root, "components", "CartLink.tsx"), "utf8");
const homeSource = readFileSync(join(root, "app", "HomeClient.tsx"), "utf8");
const mobileNavigation = readFileSync(join(root, "components", "BuyerMobileNavigation.tsx"), "utf8");
const cardAction = readFileSync(join(root, "components", "ProductCardAction.tsx"), "utf8");
const styles = readFileSync(join(root, "app", "globals.css"), "utf8");

test("mobile header has a direct cart link, menu trigger, and second-row search", () => {
  assert.match(cartLinkSource, /<Link className=\{className\} href="\/cart"/);
  assert.match(cartLinkSource, /<ShoppingCart className="cartLinkIcon"/);
  assert.match(homeSource, /<BuyerMobileNavigation accountName=\{accountName\}\/>/);
  assert.match(homeSource, /className="marketTopSearch"/);
  assert.match(homeSource, /className="marketSearchClear"/);
  assert.match(styles, /\.marketHeaderInner\{grid-template-columns:44px minmax\(0,1fr\) auto;grid-template-rows:auto auto\}/);
  assert.match(styles, /\.marketHeader\{position:sticky;top:0\}/);
  assert.match(styles, /\.marketPrimaryHeader\{padding-top:calc\(9px \+ env\(safe-area-inset-top\)\)\}/);
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
  assert.match(styles, /\.buyerHomePage\{overflow-x:clip;padding-bottom:calc\(76px \+ env\(safe-area-inset-bottom\)\)\}/);
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
  assert.match(styles, /\.discoveryImageWrap\{aspect-ratio:11\/10\}/);
  assert.match(styles, /\.discoveryCardBody\{padding:6px\}/);
  assert.match(styles, /\.discoveryCardBody h3\{min-height:30px;max-height:30px;margin:1px 0 2px;[^}]*line-height:1\.15\}/);
  assert.match(styles, /\.productAvailability\{min-height:16px;margin-bottom:0/);
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
