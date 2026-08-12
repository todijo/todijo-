import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buyerSafeProductDescription } from "../lib/product-description";
import { buyerVariantPresentation, type BuyerOption, type BuyerVariant } from "../lib/product-option-display";
import { buyerPricingMessages } from "../i18n/buyer-pricing";

const productName = "New Pullover Round Neck T-shirt Women";
const options: BuyerOption[] = [{ id: "legacy", name: "Variant", position: 0, values: [
  { id: "white-s", value: `${productName} LC25224353P1 S`, position: 0, imageUrls: ["https://images.test/white.jpg"] },
  { id: "white-m", value: `${productName} LC25224353P1 M`, position: 1 },
  { id: "other-s", value: `${productName} LC25224353P1010 S`, position: 2, imageUrls: ["https://images.test/other.jpg"] },
] }];
const variant = (id: string, valueId: string): BuyerVariant => ({ id, stock: 2, active: true, priceOverride: null, values: [{ optionValue: { id: valueId, value: options[0].values.find((value) => value.id === valueId)!.value, option: { id: "legacy", name: "Variant", position: 0 } } }] });

test("legacy CJ labels become compact option and size groups without supplier codes", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, options, variants: [variant("v1", "white-s"), variant("v2", "white-m"), variant("v3", "other-s")] });
  assert.deepEqual(result.options.map((option) => option.name), ["Option", "Size"]);
  assert.deepEqual(result.options[0].values.map((value) => value.value), ["Option 1", "Option 2"]);
  assert.deepEqual(result.options[1].values.map((value) => value.value), ["S", "M"]);
  assert.doesNotMatch(JSON.stringify(result.options), /LC25224353|New Pullover/);
  assert.equal(result.variants.find((entry) => entry.id === "v2")!.values[1].optionValue.value, "M");
});

test("exact option combinations retain canonical variant IDs and never fabricate combinations", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, options, variants: [variant("white-s-id", "white-s"), variant("white-m-id", "white-m"), variant("other-s-id", "other-s")] });
  const combination = (style: string, size: string) => result.variants.find((entry) => entry.values.some(({ optionValue }) => optionValue.id === style) && entry.values.some(({ optionValue }) => optionValue.id === size));
  assert.equal(combination(result.options[0].values[0].id, result.options[1].values[1].id)?.id, "white-m-id");
  assert.equal(combination(result.options[0].values[1].id, result.options[1].values[1].id), undefined);
});

test("single-style CJ products expose sizes without leaking the legacy supplier label", () => {
  const result = buyerVariantPresentation({ productName, supplierManaged: true, options: [{ ...options[0], values: options[0].values.slice(0, 2) }], variants: [variant("v1", "white-s"), variant("v2", "white-m")] });
  assert.deepEqual(result.options.map((option) => option.name), ["Size"]);
  assert.deepEqual(result.options[0].values.map((value) => value.value), ["S", "M"]);
  assert.deepEqual(result.variants.map((entry) => entry.id), ["v1", "v2"]);
  assert.doesNotMatch(JSON.stringify(result), /LC25224353|New Pullover/);
});

test("generic marketplace structured options and variants remain unchanged", () => {
  const genericOptions: BuyerOption[] = [{ id: "material", name: "Material", position: 0, values: [{ id: "cotton", value: "Cotton", position: 0 }] }];
  const genericVariants = [variant("normal", "white-s")];
  assert.deepEqual(buyerVariantPresentation({ productName: "Normal", supplierManaged: false, options: genericOptions, variants: genericVariants }), { options: genericOptions, variants: genericVariants });
});

test("CJ HTML descriptions become safe useful text without markup, images, scripts, handlers, URLs, or opaque codes", () => {
  const source = `<p><b>Product information:</b><br>Material: Cotton<br>Color: LC25224353-P1</p><img src="https://gallery.test/a.jpg" onerror="steal()"><script>alert(1)</script><a href="javascript:steal()" onclick="steal()">Size guidance</a>`;
  const rendered = buyerSafeProductDescription(source, true).join("\n");
  assert.match(rendered, /Product information|Material: Cotton|Size guidance/);
  assert.doesNotMatch(rendered, /<p|<br|<img|script|onerror|onclick|javascript:|gallery\.test|LC25224353/);
});

test("ordinary marketplace plain-text descriptions preserve their content", () => {
  assert.deepEqual(buyerSafeProductDescription("Handmade cotton item.\n\nWash gently.", false), ["Handmade cotton item.", "Wash gently."]);
});

test("buyer content rendering has no unsanitized HTML path and remains mobile scoped", () => {
  const component = readFileSync("components/ProductDescription.tsx", "utf8"), page = readFileSync("app/product/[id]/page.tsx", "utf8"), css = readFileSync("app/globals.css", "utf8");
  assert.match(page, /buyerVariantPresentation/); assert.match(page, /<ProductDescription/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]+\.optionGroup>div[^}]*overflow-x:auto/);
  assert.match(css, /\.productDetailDescription>p/);
});

test("French pricing copy is UTF-8 and the double-encoded source is gone", () => {
  const source = readFileSync("i18n/buyer-pricing.ts", "utf8");
  assert.equal(buyerPricingMessages.fr.selectDeliveryCountry, "Sélectionnez votre pays");
  assert.doesNotMatch(source, /SÃƒ|SÃ©lectionnez/);
});

test("pricing, cart and country continue to use canonical selection identity", () => {
  const panel = readFileSync("components/ProductPurchasePanel.tsx", "utf8"), pricing = readFileSync("components/DropshippingProductPricing.tsx", "utf8");
  assert.match(panel, /variantId=\{selectedVariant\?\.id\?\?null\}/); assert.match(panel, /quantity=\{quantity\}/);
  assert.match(pricing, /variantId,quantity,destinationCountry:country/); assert.match(pricing, /SHOPPING_COUNTRY_STORAGE_KEY/);
  assert.match(panel, /setVerifiedPricing\(pricing\)/); assert.match(panel, /verifiedPricing\.variantId===selectedVariant\?\.id/);
});
