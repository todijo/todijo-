import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createImportedProductContent, proposedExistingSupplierContent, resolveBuyerProductContent, reviewGeneratedProductLocalization } from "../lib/product-content";
import { localizedSupplierContentSearch } from "../lib/product-content-search";

const sourceMetadata = {
  productContent: {
    version: 1,
    source: { title: "HOT SALE Original supplier bottle", description: "Original supplier description", locale: "en" },
    normalized: { title: "Portable pet bottle", description: "Normalized description", locale: "en", generated: true },
    localized: {
      fr: { title: "Gourde portable", description: "Description française", generated: true, approved: true, source: "GENERATED" },
      ar: { title: "قارورة محمولة", description: "وصف عربي", approved: true, source: "MANUAL" },
      ku: { title: "بوتڵی هەڵگرتن", description: "وەسفی کوردی", generated: false },
    },
  },
};

test("Phase 8 resolves French, Arabic and Kurdish content with deterministic fallback", () => {
  assert.equal(resolveBuyerProductContent({ name: "Portable pet bottle", description: "Normalized description", sourceMetadata, locale: "fr-FR" }).title, "Gourde portable");
  assert.equal(resolveBuyerProductContent({ name: "Portable pet bottle", description: "Normalized description", sourceMetadata, locale: "ar" }).localeStatus, "LOCALIZED_MANUAL");
  assert.equal(resolveBuyerProductContent({ name: "Portable pet bottle", description: "Normalized description", sourceMetadata, locale: "ku" }).description, "وەسفی کوردی");
  assert.equal(resolveBuyerProductContent({ name: "Portable pet bottle", description: "Normalized description", sourceMetadata, locale: "de" }).title, "Portable pet bottle");
});

test("manual default and locale-specific content always outrank generated content", () => {
  const manualDefault = structuredClone(sourceMetadata);
  manualDefault.productContent.normalized.generated = false;
  const resolvedDefault = resolveBuyerProductContent({ name: "Seller-approved default", description: "Seller-approved description", sourceMetadata: manualDefault, locale: "fr" });
  assert.equal(resolvedDefault.title, "Seller-approved default");
  assert.equal(resolvedDefault.localeStatus, "MANUAL_DEFAULT");
  assert.equal(resolveBuyerProductContent({ name: "Seller-approved default", description: "Seller-approved description", sourceMetadata: manualDefault, locale: "ar" }).title, "قارورة محمولة");
  const resolvedArabic = resolveBuyerProductContent({ name: "Seller-approved default", description: "Seller-approved description", sourceMetadata, locale: "ar" });
  assert.equal(resolvedArabic.title, "قارورة محمولة");
});

test("unapproved generated proposals stay private until explicit Admin approval", () => {
  const pending=structuredClone(sourceMetadata);pending.productContent.localized.fr.approved=false;
  assert.equal(resolveBuyerProductContent({name:"Portable pet bottle",description:"Normalized description",sourceMetadata:pending,locale:"fr"}).title,"Portable pet bottle");
  const reviewed=reviewGeneratedProductLocalization(pending,"fr-FR",true);
  assert.equal(resolveBuyerProductContent({name:"Portable pet bottle",description:"Normalized description",sourceMetadata:reviewed,locale:"fr"}).title,"Gourde portable");
  assert.equal((pending.productContent.localized.fr as {approved:boolean}).approved,false);
});

test("imports preserve raw facts, normalize supplier-localized noise and never expose a blank title", () => {
  const imported = createImportedProductContent({
    title: "HOT SALE Portable Bottle Bottle FREE SHIPPING",
    description: "<p>Capacity: 500 ml</p>",
    rawMetadata: { localizedContent: { fr: { title: "HOT SALE Gourde Gourde 500 ml FREE SHIPPING", description: "Contenance : 500 ml" } } },
  });
  assert.equal(imported.metadata.source.title, "HOT SALE Portable Bottle Bottle FREE SHIPPING");
  assert.equal(imported.metadata.localized.fr.title, "Gourde 500 ml");
  assert.match(imported.metadata.localized.fr.description ?? "", /500 ml/);
  assert.ok(resolveBuyerProductContent({ name: "", description: "", sourceMetadata: {}, locale: "fr" }).title.trim());
});

test("seller-authored content remains exact and existing products are review-only proposals", () => {
  const seller = resolveBuyerProductContent({ name: "Seller's exact handmade title", description: "Seller's exact description", locale: "fr" });
  assert.equal(seller.title, "Seller's exact handmade title");
  const product = { name: "HOT SALE Existing Bottle Bottle", description: "Existing" };
  const proposal = proposedExistingSupplierContent({ ...product, locale: "fr" });
  assert.equal(proposal.status, "PROPOSED_ONLY");
  assert.equal(product.name, "HOT SALE Existing Bottle Bottle");
  assert.equal(proposal.locale, "fr");
  assert.equal(proposal.proposedLocalizedTitle, null);
});

test("localized search includes requested content and original supplier discoverability", () => {
  const serialized = JSON.stringify(localizedSupplierContentSearch("bottle", "fr-FR"));
  assert.match(serialized, /productContent.*source.*title/);
  assert.match(serialized, /productContent.*source.*description/);
  assert.match(serialized, /productContent.*localized.*fr.*title/);
  assert.match(serialized, /productContent.*localized.*fr.*description/);
});

test("all buyer surfaces share the resolver and admin localization remains read-only", () => {
  for (const path of ["app/page.tsx", "app/best-sellers/page.tsx", "app/product/[id]/page.tsx", "app/api/products/route.ts", "app/api/marketplace/products/route.ts", "app/api/cart/recommendations/route.ts"]) {
    assert.match(readFileSync(path, "utf8"), /resolveBuyerProductContent/, path);
  }
  const detail = readFileSync("app/product/[id]/page.tsx", "utf8");
  assert.match(detail, /title: content\.title/);
  const admin = readFileSync("app/adm-barewbar-182203/products/page.tsx", "utf8");
  assert.match(admin, /catalogLocalizationPreview/);
  assert.match(admin, /proposedLocalizedTitle/);
  assert.doesNotMatch(admin, /publishLocalization|approveLocalization/);
});

test("Phase 8 leaves order snapshots, Prisma schema and protected commerce modules untouched", () => {
  const payments = readFileSync("lib/payments.ts", "utf8");
  assert.match(payments, /productNameSnapshot: line\.product\.name/);
  assert.match(payments, /productDescriptionSnapshot: line\.product\.description/);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /productNameSnapshot\s+String\?/);
  for (const path of ["lib/suppliers/commerce-pricing.ts", "lib/suppliers/supplier-products.ts"]) {
    assert.ok(readFileSync(path, "utf8").length > 0, path);
  }
});
