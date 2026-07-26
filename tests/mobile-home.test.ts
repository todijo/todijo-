import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cartLinkSource = readFileSync(join(process.cwd(), "components", "CartLink.tsx"), "utf8");
const homeSource = readFileSync(join(process.cwd(), "app", "HomeClient.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

test("the visible mobile cart icon is inside the full cart link", () => {
  assert.match(cartLinkSource, /<Link className=\{className\} href="\/cart"/);
  assert.match(cartLinkSource, /<ShoppingCart className="cartLinkIcon"/);
  assert.doesNotMatch(homeSource, /marketCartAction/);
});

test("mobile cart and menu controls keep touch-friendly dimensions", () => {
  assert.match(styles, /\.cartHeaderLink,\.homeCartLink\{[^}]*min-width:44px;min-height:44px/);
  assert.match(styles, /\.marketMobileMenu summary\{width:44px;height:44px\}/);
  assert.match(styles, /\.marketMobileActions>\.homeCartLink\{width:44px;height:44px/);
  assert.match(styles, /\.marketMobileActions>\.homeCartLink\{display:inline-flex\}/);
});

test("mobile scrollers are contained instead of widening the page", () => {
  assert.match(styles, /\.marketSecondaryNav\{overflow:hidden\}/);
  assert.match(styles, /\.marketSecondaryInner\{width:100%;padding-inline:11px;overflow-x:auto\}/);
  assert.match(styles, /\.categoryStrip\{width:100%;gap:6px;[^}]*scroll-snap-type:x mandatory/);
});
