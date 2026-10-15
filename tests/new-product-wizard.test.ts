import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const form = fs.readFileSync("app/seller/products/new/NewProductForm.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("add product exposes six locale-aware seller steps", () => {
  assert.match(form,/const steps = wizard\.steps/);
  assert.match(form,/aria-label=\{wizard\.progressLabel\}/);
  assert.match(form, /steps\.map/);
});

test("wizard navigation never submits", () => {
  assert.match(form, /type="button" onClick=\{continueStep\}>\{wizard\.continue\}/);
  assert.match(form, /type="button" onClick=\{\(\)=>goToStep\(step-1\)\}>\{wizard\.back\}/);
});

test("all panels stay mounted so back and forward preserve inputs", () => {
  for (let index = 0; index < 6; index += 1) assert.match(form, new RegExp(`data-wizard-step="${index}" hidden=\\{step!==${index}\\}`));
  assert.match(css, /\.sellerProductWizard \[hidden\]\{display:none!important\}/);
});

test("category and type step contains classification controls but no title or description", () => {
  const categoryStep=form.split('data-wizard-step="0"')[1]?.split('data-wizard-step="1"')[0]??"";
  assert.match(categoryStep,/<SellerCategorySelector/);
  assert.match(categoryStep,/name="condition"/);
  assert.doesNotMatch(categoryStep,/name="name"|name="description"|allowPrepurchaseQuestions/);
});

test("photo step reuses existing media managers", () => {
  const informationStep=form.split('data-wizard-step="1"')[1]?.split('data-wizard-step="2"')[0]??"";
  for (const name of ["name", "description", "allowPrepurchaseQuestions"]) assert.match(informationStep,new RegExp(name));
  assert.equal(informationStep.match(/<ProductImageManager/g)?.length, 1);
  assert.equal(informationStep.match(/<ProductVideoManager/g)?.length, 1);
});

test("variant choice is localized and keeps the existing editor", () => {
  assert.match(form, /description=\{wizard\.variantsQuestion\}/);
  assert.match(form, />\{wizard\.no\}<\/button>[\s\S]*>\{wizard\.yes\}<\/button>/);
  assert.equal(form.match(/<ProductVariantEditor/g)?.length, 1);
  assert.equal(form.match(/<VariantImageManager/g)?.length, 1);
});

test("simple pricing and stock retain existing fields", () => {
  for (const name of ["price", "compareAtPrice", "stock"]) assert.match(form, new RegExp(`name="${name}"`));
  assert.match(form, /!variantsEnabled && <SellerSection icon=\{Boxes\} title=\{t\("inventory"\)\}/);
});

test("variant configuration stays in Step 3 while its editable SKU, price and stock matrix is in Step 4",()=>{
  const variantsStep=form.split('data-wizard-step="2"')[1]?.split('data-wizard-step="3"')[0]??"";
  const pricingStep=form.split('data-wizard-step="3"')[1]?.split('data-wizard-step="4"')[0]??"";
  assert.match(variantsStep,/hideSellerInventory/);
  assert.doesNotMatch(variantsStep,/ProductVariantInventoryFields/);
  assert.match(pricingStep,/<ProductVariantInventoryFields draft=\{variantDraft\}/);
  assert.match(pricingStep,/onChange=\{setVariantDraft\}/);
  assert.match(pricingStep,/currency=\{currency\}/);
  assert.match(form,/step:3,fieldId:index>=0\?`variant-price-\$\{index\}`/);
  assert.match(css,/sellerVariantEditorConfigurationOnly \.sellerVariantMatrix\{display:none!important\}/);
});

test("shipping makes inheritance primary and override explicit", () => {
  assert.match(form, /shipping\("inheritStoreShipping"\)/);
  assert.match(form, /shipping\("customProductShipping"\)/);
  assert.match(form, /<ShippingRuleFields value=\{shippingRule\}/);
});

test("verification displays missing required information and owns final actions", () => {
  assert.match(form, /querySelectorAll<[^>]+>\(":invalid"\)/);
  assert.match(form, /\{wizard\.complete\}/);
  assert.ok(form.indexOf('data-wizard-step="5"') < form.indexOf('value="DRAFT"'));
  assert.ok(form.indexOf('data-wizard-step="5"') < form.indexOf('value="PUBLISHED"'));
});

test("final review summarizes seller-entered product, media, option image assignments, variants, pricing, stock and shipping",()=>{
  assert.match(form,/makeReviewSnapshot\(\)/);
  assert.match(form,/setReviewSnapshot\(makeReviewSnapshot\(\)\)/);
  for(const field of ["category","condition","productName","description","images","productOptions","variantSku","shipping(\"productSettingsTitle\")"])assert.ok(form.includes(field),field);
  assert.match(form,/sellerProductWizardSummary/);
  assert.match(form,/variantImages:variantImages\.map\(assignment=>\(\{\.\.\.assignment,imageUrls:\[\.\.\.assignment\.imageUrls\]\}\)\)/);
  assert.match(form,/reviewSnapshot\.variantImages\.map/);
  assert.match(form,/variant\.priceOverride\?\?reviewSnapshot\.price/);
});

test("wizard action bar remains in document flow and reserves space around the floating control",()=>{
  assert.match(css,/\.sellerProductWizard>\.sellerControlActionBar\{position:static/);
  assert.match(css,/padding-inline-end:78px/);
  assert.match(css,/padding-block-end:calc\(142px \+ env\(safe-area-inset-bottom\)\)/);
});

test("submission keeps the established API payload and draft/publish statuses", () => {
  assert.match(form, /fetch\("\/api\/products"/);
  for (const field of ["images", "video", "variantsEnabled", "variantImages", "allowPrepurchaseQuestions", "complianceDeclaration", "shippingOverrideEnabled"]) assert.ok(form.includes(field));
  assert.match(form, /status: "DRAFT" \| "PUBLISHED"/);
});

test("wizard has a compact mobile layout", () => {
  assert.match(css, /@media\(max-width:720px\)\{\.sellerProductWizardProgress/);
  assert.match(css, /\.sellerProductWizardChoices\{grid-template-columns:1fr\}/);
  assert.match(css,/\.sellerProductWizardProgress li:not\(\.isCurrent\)\{display:none\}/);
  assert.match(css,/\.sellerProductWizardProgress ol\{min-width:0;grid-template-columns:minmax\(0,1fr\)\}/);
});
