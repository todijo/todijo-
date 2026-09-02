import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const home = readFileSync(join(root, "app", "HomeClient.tsx"), "utf8");
const page = readFileSync(join(root, "app", "page.tsx"), "utf8");
const styles = readFileSync(join(root, "app", "globals.css"), "utf8");

test("Nouveautés uses at most ten real newest products and preserves product card behavior", () => {
  assert.match(page, /orderBy: \{ createdAt: "desc" \}, take: 10, select: productSelect/);
  assert.match(home, /products=\{newArrivals\.slice\(0,10\)\}/);
  assert.match(home, /MarketplaceProductCard key=\{product\.id\} product=\{product\} soldOut=\{soldOut\}/);
  assert.match(home, /titleHref=\{`\/\$\{activeLocale\}\?sort=newest#products`\}/);
});

test("Nouveautés is a controlled swipeable carousel with localized arrows", () => {
  assert.match(home, /className="marketplaceRailArrows"/);
  assert.match(home, /scrollBy\(\{ left: direction/);
  assert.match(home, /carousel previous=\{t\.previous\} next=\{t\.next\}/);
  assert.match(styles, /\.marketplaceRailSection\.isCarousel \.marketplaceProductRail\{display:flex!important/);
  assert.match(styles, /overflow-x:auto!important/);
  assert.match(styles, /scroll-snap-type:x mandatory/);
  assert.match(styles, /\[dir=rtl\] \.marketplaceRailArrows svg/);
});

test("premium hero receives a wider, shorter responsive container without altering slider behavior", () => {
  assert.match(home, /className="container premiumHeroContainer"/);
  assert.match(styles, /premiumHeroContainer\{width:min\(1720px,calc\(100% - 24px\)\)\}/);
  assert.match(styles, /premiumHeroSlider\{height:clamp\(410px,34vw,500px\)\}/);
  assert.match(styles, /@media\(max-width:430px\)[\s\S]*premiumHeroSlider\{height:470px\}/);
});
