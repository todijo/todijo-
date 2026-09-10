import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const form = fs.readFileSync("app/seller/products/new/NewProductForm.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("add product exposes the six French seller steps", () => {
  for (const label of ["Produit", "Photos", "Variantes", "Prix & stock", "Livraison", "Vérification"]) assert.ok(form.includes(label));
  assert.match(form, /steps\.map/);
});

test("wizard navigation never submits", () => {
  assert.match(form, /type="button" onClick=\{\(\)=>goToStep\(step\+1\)\}>Continuer/);
  assert.match(form, /type="button" onClick=\{\(\)=>goToStep\(step-1\)\}>Retour/);
});

test("all panels stay mounted so back and forward preserve inputs", () => {
  for (let index = 0; index < 6; index += 1) assert.match(form, new RegExp(`data-wizard-step="${index}" hidden=\\{step!==${index}\\}`));
  assert.match(css, /\.sellerProductWizard \[hidden\]\{display:none!important\}/);
});

test("product step retains existing core fields", () => {
  for (const name of ["name", "description", "condition"]) assert.match(form, new RegExp(`name="${name}"`));
  assert.match(form, /<SellerCategorySelector/);
});

test("photo step reuses existing media managers", () => {
  assert.equal(form.match(/<ProductImageManager/g)?.length, 1);
  assert.equal(form.match(/<ProductVideoManager/g)?.length, 1);
});

test("variant choice uses plain French and the existing editor", () => {
  assert.match(form, /Votre produit existe-t-il en plusieurs couleurs, tailles, modèles ou versions \?/);
  assert.match(form, />Non<\/button>[\s\S]*>Oui<\/button>/);
  assert.equal(form.match(/<ProductVariantEditor/g)?.length, 1);
  assert.equal(form.match(/<VariantImageManager/g)?.length, 1);
});

test("simple pricing and stock retain existing fields", () => {
  for (const name of ["price", "compareAtPrice", "stock"]) assert.match(form, new RegExp(`name="${name}"`));
  assert.match(form, /!variantsEnabled && <SellerSection icon=\{Boxes\} title=\{t\("inventory"\)\}/);
});

test("shipping makes inheritance primary and override explicit", () => {
  assert.match(form, /Utiliser les paramètres de livraison de ma boutique/);
  assert.match(form, /Modifier la livraison pour ce produit/);
  assert.match(form, /<ShippingRuleFields value=\{shippingRule\}/);
});

test("verification displays missing required information and owns final actions", () => {
  assert.match(form, /querySelectorAll\(":invalid"\)/);
  assert.match(form, /Toutes les informations obligatoires sont renseignées/);
  assert.ok(form.indexOf('data-wizard-step="5"') < form.indexOf('value="DRAFT"'));
  assert.ok(form.indexOf('data-wizard-step="5"') < form.indexOf('value="PUBLISHED"'));
});

test("submission keeps the established API payload and draft/publish statuses", () => {
  assert.match(form, /fetch\("\/api\/products"/);
  for (const field of ["images", "video", "variantsEnabled", "variantImages", "allowPrepurchaseQuestions", "complianceDeclaration", "shippingOverrideEnabled"]) assert.ok(form.includes(field));
  assert.match(form, /status: "DRAFT" \| "PUBLISHED"/);
});

test("wizard has a compact mobile layout", () => {
  assert.match(css, /@media\(max-width:720px\)\{\.sellerProductWizardProgress/);
  assert.match(css, /\.sellerProductWizardChoices\{grid-template-columns:1fr\}/);
});
