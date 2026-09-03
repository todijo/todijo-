import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDropshippingEligibility, usesEmbeddedDropshippingShipping } from "../lib/suppliers/commerce-pricing";

const source = (path: string) => readFileSync(path, "utf8");

test("seller and legal information move below the buying decision without losing trust actions", () => {
  const page = source("app/product/[id]/page.tsx");
  assert.equal(page.match(/<SellerTypeDisclosure/g)?.length, 1);
  assert.equal(page.match(/className="productSellerLink"/g)?.length, 1);
  assert.ok(page.indexOf("productDetailDescriptionSection") < page.indexOf("productSellerInformationCard"));
  assert.ok(page.indexOf("productSellerInformationCard") < page.indexOf("<ReviewSection"));
  assert.match(page, /productSellerInformationCard[\s\S]*SellerTypeDisclosure[\s\S]*AskSellerButton[\s\S]*ProductReportButton/);
  assert.doesNotMatch(page, /productFacts productFactsDesktop[^\n]*detailText\("viewShop"\)/);
});

test("desktop V4 keeps gallery and purchase panel sticky below navigation with one bounded option scroller", () => {
  const css = source("app/globals.css"), panel = source("components/ProductPurchasePanel.tsx");
  assert.match(css, /--product-detail-sticky-top:198px/);
  assert.match(css, /@media\(min-width:1201px\)[^{]*\{[^}]*productDetailShell\{width:min\(1600px/);
  assert.match(css, /productGallerySticky,\.productPurchaseColumn\{position:sticky;top:var\(--product-detail-sticky-top\)/);
  assert.match(css, /productPurchaseCard\{[^}]*max-height:calc\(100vh - var\(--product-detail-sticky-top\) - 16px\)/);
  assert.match(css, /purchaseOptionsScroll\{[^}]*overflow-y:auto;overscroll-behavior:contain/);
  assert.match(panel, /purchaseOptionsScroll[\s\S]*purchaseActionFooter[\s\S]*DropshippingProductPricing[\s\S]*AddToCartButton/);
});

test("desktop precise-pointer gallery uses object-fit-aware hover zoom while touch retains lightbox", () => {
  const gallery = source("app/product/[id]/ProductGallery.tsx"), css = source("app/globals.css");
  assert.match(gallery, /\(min-width: 1201px\) and \(hover: hover\) and \(pointer: fine\)/);
  assert.match(gallery, /className="productMainImageZoomSurface"/);
  assert.match(gallery, /getBoundingClientRect\(\)[\s\S]*getComputedStyle\(image\)\.objectFit/);
  assert.match(gallery, /productHoverZoomLens[\s\S]*productHoverZoomPanel/);
  assert.doesNotMatch(gallery, /className="productMainImageButton"/);
  assert.match(gallery, /className="productMobileImageSlide"[\s\S]*setIsOpen\(true\)/);
  assert.match(gallery, /addEventListener\("todijo:variant-images"/);
  assert.match(css, /productHoverZoomPanel\{[^}]*left:calc\(100% \+ 16px\)/);
});

test("shipping presentation authority is product-specific and manual override is not reclassified", () => {
  const normal = resolveDropshippingEligibility({ hasSupplierLink: false });
  const automatic = resolveDropshippingEligibility({ hasSupplierLink: true, provider: "CJ", ownerType: "PLATFORM", connectionStatus: "CONNECTED", sourceMetadata: { pricing: { mode: "AUTOMATIC" } } });
  const manual = resolveDropshippingEligibility({ hasSupplierLink: true, provider: "CJ", ownerType: "PLATFORM", connectionStatus: "CONNECTED", sourceMetadata: { pricing: { mode: "MANUAL_OVERRIDE" } } });
  assert.equal(usesEmbeddedDropshippingShipping(normal), false);
  assert.equal(usesEmbeddedDropshippingShipping(automatic), true);
  assert.equal(usesEmbeddedDropshippingShipping(manual), false);
  const page = source("app/product/[id]/page.tsx");
  assert.match(page, /!usesDropshippingShipping&&shippingRule\.shippingEnabled/);
  assert.match(page, /usesEmbeddedDropshippingShipping\(dropshippingEligibility\)/);
});

test("normal and CJ lines retain existing line-aware checkout and embedded-shipping contracts", () => {
  const payments = source("lib/payments.ts"), pricing = source("lib/suppliers/commerce-pricing.ts");
  assert.match(payments, /resolvedLines\.filter\(line=>Boolean\(line\.pricingSnapshot\)\|\|line\.displayedCurrency!=null\|\|line\.displayedUnitPrice!=null\)/);
  assert.match(payments, /if\(key==="cj:platform"\)\{groupQuotes\.set\(key,embeddedShippingQuote\(groupLines/);
  assert.match(payments, /cartShippingQuote\(groupLines\[0\]\.product\.store/);
  assert.match(payments, /convertMarketplacePrice\(source\.amount,groupLines\[0\]\.product\.currency,paymentCurrency,pricingDependencies\.marketplaceFx\)/);
  assert.match(pricing, /shippingIncluded=mode==="AUTOMATIC"/);
  assert.match(pricing, /readGlobalDropshippingMargin/);
  assert.match(pricing, /verifiedFxRate/);
});
