import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("new product publish stays on the form and resets all state only after success", async () => {
  const source = await readFile("app/seller/products/new/NewProductForm.tsx", "utf8");
  assert.match(source, /if \(!response\.ok\).*return/);
  assert.match(source, /if \(status === "DRAFT"\).*router\.push/);
  assert.ok(source.indexOf('if (status === "DRAFT")') < source.indexOf("setImages([])"));
  for (const reset of ["setImages([])", "setVariantsEnabled(false)", "setVariantDraft(", "setVariantImages([])", "setBasePrice(\"\")", "setProductStock(\"1\")", "setResetGeneration("]) assert.ok(source.includes(reset), `missing reset: ${reset}`);
  assert.ok(source.includes('submitter?.value === "DRAFT"'));
  assert.match(source, /disabled=\{submitting \|\| uploading \|\| disabledByLimit\}/);
});

test("edit product preserves status and has no duplicate publication controls", async () => {
  const source = await readFile("app/seller/products/[id]/edit/EditProductForm.tsx", "utf8");
  assert.match(source, /status:product\.status/);
  assert.doesNotMatch(source, /sellerPublishChoices|t\("publishing"\)|name="status"/);
});

test("publish success translation has English and French parity", async () => {
  const [en, fr] = await Promise.all(["en", "fr"].map(async (locale) => JSON.parse(await readFile(`messages/seller-control/${locale}.json`, "utf8")) as Record<string, string>));
  assert.equal(en.productPublishedSuccess, "Product published successfully. You can now add another product.");
  assert.equal(fr.productPublishedSuccess, "Produit publié avec succès. Vous pouvez maintenant ajouter un nouveau produit.");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
});
