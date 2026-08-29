import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const locales = ["ar","de","en","es","fa","fr","hi","it","ku","nl","pt","ru","tr","zh"];

test("homepage renders exactly one shared marketplace header and localized hero routing", () => {
  const home = source("app/HomeClient.tsx");
  assert.equal((home.match(/<MarketplaceHeader/g) ?? []).length, 1);
  assert.match(home, /h\("heroEyebrow"\)/);
  assert.match(home, /h\("heroTitle"\)/);
  assert.match(home, /h\("heroText"\)/);
  assert.match(home, /href="#products"/);
  assert.match(home, /href=\{`\/\$\{activeLocale\}\/store`\}/);
});

test("professional hero and accurate delivery copy have complete locale parity", () => {
  const headerKeys = Object.keys(JSON.parse(source("messages/home-header/en.json"))).sort();
  const discoveryKeys = Object.keys(JSON.parse(source("messages/home-discovery/en.json"))).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(JSON.parse(source(`messages/home-header/${locale}.json`))).sort(), headerKeys);
    assert.deepEqual(Object.keys(JSON.parse(source(`messages/home-discovery/${locale}.json`))).sort(), discoveryKeys);
  }
  assert.equal(JSON.parse(source("messages/home-header/fr.json")).heroTitle, "Vos envies, à petits prix !");
  assert.doesNotMatch(JSON.parse(source("messages/home-discovery/fr.json")).deliveryText, /gratuite partout/i);
});

test("header country and currency trigger is explicitly high contrast", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.marketHeader \.buyerMarketTrigger\{[^}]*color:#fff!important/);
  assert.match(css, /\.marketHeader \.buyerMarketTrigger span[^}]*color:#fff!important/);
});

test("mobile hero, store discovery and trust cards remain visible and contained", () => {
  const css = source("app/globals.css");
  assert.match(css, /@media\(max-width:860px\)[\s\S]*\.buyerHomePage \.discoveryHero[^}]*display:block!important/);
  assert.match(css, /\.featuredStoreGrid\{display:flex;[^}]*overflow-x:auto/);
  assert.match(css, /\.buyerHomePage\{overflow-x:clip/);
  assert.match(css, /@media\(max-width:420px\)/);
});

test("product cards expose real store metadata without touching price or cart authority", () => {
  const card = source("components/MarketplaceProductCard.tsx");
  assert.match(card, /className="marketplaceStore"/);
  assert.match(card, /BuyerProductPrice/);
  assert.match(card, /ProductCardAction/);
  assert.doesNotMatch(card, /rating|reviewCount|Nouveau|New badge/);
});

test("Phase 2 remains presentation-only and Phase 1 visibility is retained", () => {
  const page = source("app/page.tsx");
  assert.match(page, /publicProductAccessWhere/);
  assert.match(page, /publicStoreAccessWhere/);
  assert.match(source("lib/admin-access.ts"), /dataClass:\s*"PRODUCTION"/);
  assert.equal(fs.readdirSync(path.join(root, "prisma/migrations")).some(name => /phase.?2|marketplace.?ui|professional.?marketplace/i.test(name)), false);
});
