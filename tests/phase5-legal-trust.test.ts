import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales } from "../i18n/config";
import { legalPhase5Messages } from "../i18n/legal-phase5";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("all buyer-facing legal routes are canonical, localized, and reachable from legal navigation", () => {
  const page = read("app", "info", "[slug]", "page.tsx");
  const footer = read("components", "MarketplaceFooter.tsx");
  for (const slug of ["terms", "seller-terms", "returns", "privacy", "cookies", "privacy-data", "data-deletion", "legal-notice", "marketplace-rules"]) {
    assert.match(page, new RegExp(`(?:\\"|')${slug}(?:\\"|')`), slug);
    assert.match(footer, new RegExp(`info\\(\\"${slug}\\"\\)`), slug);
  }
  assert.match(page, /localizedAlternates\(locale, pathname\)/);
  assert.match(page, /cms\?\.seoTitle \|\| cms\?\.title \|\| title/);
  assert.match(page, /cms \? <><SafeSiteContent/);
});

test("footer has one clear destination for every legal link", () => {
  const footer = read("components", "MarketplaceFooter.tsx");
  const groups = footer.slice(footer.indexOf("const groups"), footer.indexOf("return <footer"));
  for (const slug of ["terms", "seller-terms", "returns", "privacy", "cookies", "privacy-data", "data-deletion", "legal-notice", "marketplace-rules"]) {
    assert.equal([...groups.matchAll(new RegExp(`info\\(\\"${slug}\\"\\)`, "g"))].length, 1, slug);
  }
});

test("buyer protection matches the implemented review and financial lifecycle without escrow claims", () => {
  const copy = legalPhase5Messages.en.buyerProtectionBody;
  for (const phrase of ["seller an opportunity to review", "authorised Todijo administrator", "physical return and inspection", "original Stripe payment records", "retry-safe processing", "not escrow"]) assert.match(copy, new RegExp(phrase, "i"));
  assert.doesNotMatch(copy, /(?<!not )guarantees? every|holds? (?:your )?money|all shipping is free/i);
  const sellerRoute = read("app", "api", "seller", "refund-requests", "[requestId]", "route.ts");
  const adminRoute = read("app", "api", "admin", "refund-requests", "[requestId]", "route.ts");
  const lifecycle = read("lib", "refund-lifecycle.ts");
  assert.match(sellerRoute, /decideSellerRefundRequest/);
  assert.match(adminRoute, /decideAdminRefundRequest/);
  assert.match(lifecycle, /returnRequired[\s\S]*AWAITING_RETURN/);
  assert.match(lifecycle, /idempotencyKey/);
});

test("buyer-facing policy content has no demo copy and describes Stripe, safety, and shipping truthfully", () => {
  const buyerPolicyFiles = [
    ["messages", "legal", "en.json"],
    ["messages", "legal-cleanup", "en.json"],
    ["messages", "info-pages", "en.json"],
    ["messages", "privacy", "en.json"],
  ] as const;
  const content = buyerPolicyFiles.map((parts) => read(...parts)).join("\n");
  assert.doesNotMatch(content, /lorem ipsum|dummy content|demo (?:text|content)|placeholder (?:text|content)|test seller|test buyer/i);
  assert.match(content, /Stripe processes checkout/);
  assert.match(content, /does not receive full card details/);
  assert.match(content, /Illegal, unsafe, counterfeit/);
  assert.match(content, /does not promise a universal carrier or delivery time/);
  assert.doesNotMatch(content, /all (?:Todijo )?shipping is free|free shipping on all|escrow account/i);
  const supplierCopy = read("i18n", "supplier.ts");
  assert.match(supplierCopy, /dropship/i);
});

test("new trust copy is localized or uses one deterministic English fallback", () => {
  assert.deepEqual(Object.keys(legalPhase5Messages).sort(), [...locales].sort());
  for (const locale of locales) {
    const copy = legalPhase5Messages[locale];
    assert.ok(copy.buyerProtectionTitle.trim());
    assert.ok(copy.buyerProtectionBody.trim());
  }
  const request = read("i18n", "request.ts");
  assert.match(request, /legalPhase5Messages\[locale\]/);
  assert.match(request, /legalEnglish[\s\S]*legalLocalized[\s\S]*common/);
});

test("seller trust stays declarative and badges remain backed by stored seller type", () => {
  const disclosure = read("components", "SellerTypeDisclosure.tsx");
  const productPage = read("app", "product", "[id]", "page.tsx");
  assert.match(disclosure, /sellerType === "PROFESSIONAL"/);
  assert.match(disclosure, /sellerType === "UNKNOWN"/);
  assert.doesNotMatch(disclosure, /verified seller|verifiedSeller/i);
  assert.match(productPage, /sellerType/);
});

test("legal presentation contains mobile and RTL overflow safeguards", () => {
  const css = read("app", "globals.css");
  assert.match(css, /\.legalProtectionSummary\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\[dir="rtl"\] \.legalProtectionSummary\{text-align:right/);
  assert.match(css, /@media\(max-width:420px\)[\s\S]*\.legalPolicyHeader h1\{overflow-wrap:anywhere/);
  assert.match(css, /\.marketInfoPage\{overflow-x:clip\}/);
});

test("Phase 5 changes are presentation-only and do not introduce schema or payment logic", () => {
  const status = read("components", "MarketplaceLegalPolicy.tsx");
  assert.doesNotMatch(status, /fetch\(|prisma|stripe\./i);
  assert.equal(fs.existsSync(path.join(process.cwd(), "prisma", "migrations", "20260829_phase5")), false);
});
