import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("variant option inputs use a fixed readable-on-white control palette", () => {
  const css = source("app/globals.css");
  assert.match(css, /--seller-variant-input-text:#173b30/);
  assert.match(css, /sellerVariantOptionTop input,.sellerVariantAddValue input\{[^}]+background:#fff;color:var\(--seller-variant-input-text\)/);
});

test("Style and custom option controls add through the atomic option updater", () => {
  const editor = source("components/ProductVariantEditor.tsx");
  assert.match(editor, /\{ name: "Style", preset: "style" \}/);
  assert.match(editor, /const addOption = \(name: string, preset\?: Preset\) => setOptions\(\(current\) =>/);
  assert.match(editor, /onClick=\{\(\) => addOption\(""\)\}/);
  assert.match(editor, /option\.preset \?[\s\S]+: <label>\{t\("optionName"\)\}<input value=\{option\.name\}/);
});

test("product images precede product options on create and edit", () => {
  const create = source("app/seller/products/new/NewProductForm.tsx");
  assert.ok(create.indexOf('title={t("images")}') < create.indexOf('title={t("productOptions")}'));

  const edit = source("app/seller/products/[id]/edit/EditProductForm.tsx");
  assert.ok(edit.indexOf('title={t("images")}') < edit.indexOf("{variantEditor}"));
  assert.ok(edit.indexOf("{variantEditor}") < edit.indexOf('title={t("variantImages")}'));
});
