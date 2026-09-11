import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const form=fs.readFileSync("app/seller/products/new/NewProductForm.tsx","utf8");
const variants=fs.readFileSync("components/ProductVariantEditor.tsx","utf8");
const images=fs.readFileSync("components/VariantImageManager.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");

test("Continue validates only the visible current step and focuses its first invalid field",()=>{
  assert.match(form,/querySelector<HTMLElement>\(`\[data-wizard-step="\$\{step\}"\]`\)/);
  assert.match(form,/panel\?\.querySelector<[^>]+>\(":invalid"\)/);
  assert.match(form,/invalid\.scrollIntoView[\s\S]*invalid\.focus\(\)[\s\S]*invalid\.reportValidity\(\)/);
});

test("future progress steps are disabled while Back remains available",()=>{
  assert.match(form,/disabled=\{index>step\}/);
  assert.match(form,/step>0[\s\S]*goToStep\(step-1\)[\s\S]*>Retour/);
});

test("mounted step panels preserve seller-entered state",()=>{
  for(let index=0;index<6;index+=1)assert.match(form,new RegExp(`data-wizard-step="${index}" hidden=\\{step!==${index}\\}`));
});

test("seller-first variants use compact option and value chips",()=>{
  assert.match(form,/<ProductVariantEditor[^>]+sellerFirst/);
  assert.match(variants,/sellerFirst = false/);
  assert.match(variants,/className="sellerVariantValues"/);
  assert.match(css,/\.sellerProductWizard \.sellerVariantOption\{padding:12px/);
});

test("seller-first combinations reconcile automatically within the existing maximum",()=>{
  assert.match(variants,/if \(!sellerFirst \|\| productId\) return/);
  assert.match(variants,/if \(combinationLabels\.length > MAX_PRODUCT_VARIANTS\) return/);
  assert.match(variants,/setVariants\(\(current\) =>/);
  assert.match(variants,/previous\.get\(key\) \?\?/);
});

test("normal seller workflow has no manual Generate action",()=>{
  assert.match(variants,/\{!sellerFirst&&<button[\s\S]+generateVariantCount/);
});

test("variant price and stock use a compact matrix with bulk helpers",()=>{
  assert.match(variants,/<table><thead><tr><th>Variante<\/th><th>Prix<\/th><th>Stock<\/th><th>Disponible<\/th>/);
  assert.match(variants,/Appliquer le prix à toutes/);
  assert.match(variants,/Appliquer le stock à toutes/);
  assert.match(variants,/priceOverride:bulkPrice\|\|null/);
  assert.match(variants,/stock:Number\(bulkStock\)/);
});

test("variant products require their own prices and derive the canonical product price",()=>{
  assert.match(form,/resolveProductPriceInput\(\{variantsEnabled:true,basePrice,variants:variantDraft\.variants\}\)/);
  assert.match(form,/required=\{!variantsEnabled\}/);
  assert.match(form,/productStockForForm\(variantsEnabled, productStock\)/);
});

test("SKU barcode and compare price remain available behind Options avancées",()=>{
  assert.match(variants,/<details className="sellerVariantAdvanced"><summary>Options avancées<\/summary>/);
  for(const field of ["variantSku","variantBarcode","comparePrice"])assert.ok(variants.includes(field));
});

test("seller-first image assignment targets color or the first meaningful option",()=>{
  assert.match(form,/<VariantImageManager[^>]+primaryOptionOnly/);
  assert.match(images,/\["color","couleur"\]/);
  assert.match(images,/\? \[options\.find/);
});

test("verification enumerates every blocker with a correction action",()=>{
  assert.match(form,/publishBlockers\.map\(blocker=>/);
  assert.match(form,/>Corriger<\/button>/);
  assert.match(form,/focusBlocker\(blocker\)/);
});

test("Corriger navigates and focuses the blocker field",()=>{
  assert.match(form,/setStep\(blocker\.step\)/);
  assert.match(form,/document\.getElementById\(blocker\.fieldId\)/);
  assert.match(form,/field\?\.scrollIntoView[\s\S]*field\?\.focus/);
});

test("Publish remains disabled until blocker collection is ready and empty",()=>{
  assert.match(form,/value="PUBLISHED" disabled=\{submitting \|\| !blockersReady \|\| publishBlockers\.length>0\}/);
});

test("DRAFT and PUBLISHED retain the established API payload semantics",()=>{
  assert.match(form,/status: "DRAFT" \| "PUBLISHED"/);
  assert.match(form,/fetch\("\/api\/products", \{/);
  for(const field of ["variants: variantsEnabled ? variantDraft : undefined","variantImages: variantsEnabled ? variantImages : []","shippingOverrideEnabled","complianceDeclaration"])assert.ok(form.includes(field));
});
