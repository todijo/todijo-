import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("newsletter footer no longer collects an email without a backend", () => {
  const source = read("components", "MarketplaceFooter.tsx");
  assert.doesNotMatch(source, /footer-newsletter|handleNewsletter|newsletterUnavailable|type="email"/);
  assert.match(source, /newsletterTitle/);
});

test("VAT choices use cards while preserving backend values", () => {
  const source = read("components", "SellerTypeFields.tsx");
  assert.match(source, /\["REGISTERED", "NOT_REGISTERED_OR_NOT_APPLICABLE"\]/);
  assert.match(source, /name="vatStatus"/);
  assert.match(source, /className=\{vatStatus === status \? "isSelected" : ""\}/);
  const css = read("app", "globals.css");
  assert.match(css, /\.sellerVatChoice label\.isSelected\{[^}]*border-color:#0b8f65/);
});

test("seller readiness distinguishes seller type, VAT, and subscription gates", () => {
  for (const file of [read("app", "dashboard", "page.tsx"), read("app", "seller", "products", "page.tsx")]) {
    assert.match(file, /sellerTypeRequired/);
    assert.match(file, /vatStatusRequired/);
    assert.match(file, /store-settings#seller-status/);
    assert.match(file, /seller\/products\/new/);
  }
});

test("public store reuses shared marketplace architecture and real product cards", () => {
  const page = read("app", "store", "[slug]", "page.tsx");
  assert.match(page, /<SiteHeader/);
  assert.match(page, /<MarketplaceFooter/);
  assert.doesNotMatch(page, /premiumStoreHeader|premiumStoreFooter|BuyerMobileHeader/);
  const experience = read("app", "store", "[slug]", "StoreExperience.tsx");
  assert.match(experience, /MarketplaceProductCard/);
  assert.doesNotMatch(experience, /5,0|100%|<24h|reviews|gallery|policies/);
});

test("public store translations have exact 14-locale parity", () => {
  const locales = ["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"];
  const expected = Object.keys(JSON.parse(read("messages", "public-store", "en.json"))).sort();
  for (const locale of locales) assert.deepEqual(Object.keys(JSON.parse(read("messages", "public-store", `${locale}.json`))).sort(), expected, locale);
});
