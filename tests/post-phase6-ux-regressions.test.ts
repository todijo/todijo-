import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "../i18n/config";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("new and edit product compliance fields share explicit light-surface contrast", () => {
  const css = source("app/globals.css");
  const compliance = source("components/ProductComplianceFields.tsx");
  assert.match(css, /\.sellerControlForm \.productComplianceFields input[^}]*background:#fff;color:#173b30;caret-color:#087653/);
  assert.match(css, /\.sellerControlForm \.productComplianceFields input::placeholder[^}]*color:#6b7f77/);
  assert.match(css, /\.sellerControlForm \.listingDeclaration[^}]*color:#173b30/);
  assert.match(compliance, /className="productComplianceFields"/);
  assert.match(source("app/seller/products/new/NewProductForm.tsx"), /<ProductComplianceFields\/>/);
  assert.match(source("app/seller/products/\[id\]/edit/EditProductForm.tsx"), /<ProductComplianceFields initial=\{product\}\/>/);
});

test("product description and contact CTA stay bounded and responsive", () => {
  const css = source("app/globals.css");
  assert.match(css, /productDetailDescription[^}]*max-width:72ch[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/);
  assert.match(css, /productAskSeller \.askSellerButton\{width:auto;max-width:100%/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*productAskSeller \.askSellerButton\{width:100%\}/);
});

test("contact seller enforces the authoritative minimum without premature send errors", () => {
  const ui = source("components/AskSellerButton.tsx");
  const api = source("app/api/conversations/route.ts");
  assert.match(api, /message\.length < 12 \|\| message\.length > 2000/);
  assert.match(ui, /MIN_MESSAGE_LENGTH = 12/);
  assert.match(ui, /disabled=\{busy \|\| message\.trim\(\)\.length < MIN_MESSAGE_LENGTH/);
  assert.doesNotMatch(ui, /message\.length > 0[^\n]+messageError/);
  assert.match(ui, /PREPURCHASE_QUESTIONS_DISABLED[^\n]+questionsDisabledError/);
  assert.match(ui, /aria-busy=\{busy\}/);
});

test("seller order history uses the shared seller workspace and compact search card", () => {
  const page = source("app/seller/orders/page.tsx");
  const layout = source("components/SellerDashboardLayout.tsx");
  const css = source("app/globals.css");
  assert.match(page, /<SellerDashboardLayout[^>]+active="orders"/);
  assert.doesNotMatch(page, /<SiteHeader|<MarketplaceFooter/);
  assert.match(layout, /href: `\/\$\{locale\}\/seller\/orders`[^\n]+active: active === "orders"/);
  assert.match(css, /\.sellerOrdersSearch\{[^}]*padding:20px/);
  assert.doesNotMatch(page, /className="buyerOrdersEmpty"/);
});

test("contact message translations have exact key and placeholder parity in all locales", () => {
  const expected = JSON.parse(source("messages/contact-message/en.json")) as Record<string, string>;
  const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
  for (const locale of locales) {
    const messages = JSON.parse(source(`messages/contact-message/${locale}.json`)) as Record<string, string>;
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(expected).sort(), locale);
    for (const key of Object.keys(expected)) assert.deepEqual(placeholders(messages[key]), placeholders(expected[key]), `${locale}:${key}`);
  }
});
