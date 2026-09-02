import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const locales = ["fr", "en", "ar", "de", "es", "fa", "hi", "it", "ku", "nl", "pt", "ru", "tr", "zh"] as const;

const read = (file: string) => fs.readFileSync(file, "utf8");

test("desktop homepage rails present five complete cards without changing product data", () => {
  const home = read("app/HomeClient.tsx");
  const css = read("app/globals.css");
  assert.match(css, /grid-auto-columns:calc\(\(100% - 56px\)\/5\)/);
  assert.match(css, /marketplaceRailSection:not\(\.isCarousel\) \.marketplaceProductRail\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}/);
  assert.match(home, /newArrivals\.slice\(0,10\)/);
  assert.match(home, /products\.map\(\(product\) => <MarketplaceProductCard/);
});

test("five feature cards keep artwork and copy in separate zones", () => {
  const home = read("app/HomeClient.tsx");
  const css = read("app/globals.css");
  assert.equal((home.match(/d\("(?:secure|delivery|messages|independent|confidence)Title"\)/g) ?? []).length >= 5, true);
  assert.match(home, /trustArtworkZone/);
  assert.match(home, /trustContentZone/);
  assert.equal((home.match(/loading="eager"/g) ?? []).length >= 1, true);
  assert.match(home, /hero-shopping\.webp/);
  assert.match(css, /\.todijoTrustPrimary \.todijoTrustGrid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /article:after\{display:none\}/);
});

test("promotional homepage sections are rendered exactly once", () => {
  const home = read("app/HomeClient.tsx");
  const appPromo = read("components/MobileAppPromotion.tsx");
  assert.equal((home.match(/className="container discoveryPromoBanner"/g) ?? []).length, 1);
  assert.equal((home.match(/<MobileAppPromotion\/>/g) ?? []).length, 1);
  assert.equal((appPromo.match(/className="mobileAppPromotion"/g) ?? []).length, 1);
});

test("confidence feature copy exists in every supported locale", () => {
  for (const locale of locales) {
    const messages = JSON.parse(read(`messages/home-discovery/${locale}.json`)) as Record<string, string>;
    assert.ok(messages.confidenceTitle?.trim(), `${locale} confidence title`);
    assert.ok(messages.confidenceText?.trim(), `${locale} confidence text`);
  }
});
