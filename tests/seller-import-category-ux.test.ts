import test from "node:test";
import assert from "node:assert/strict";
import { locales } from "../i18n/config";
import { DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, isCanonicalLeafCategoryId, subcategoryId } from "../lib/desktop-category-taxonomy";
import { localizedCategoryTreeValue } from "../lib/category-tree-localization";
import { localizedSellerImportMainCategory } from "../lib/seller-import-category-labels";
import { sellerImportUiCopy } from "../i18n/seller-import-copy";
import { sellerImportOtherCategoryId, isValidSellerImportCategoryId } from "../lib/seller-import-category";
import { normalizeSellerImportCategoryText, suggestSellerImportMainCategory } from "../lib/seller-import-category-suggestions";
import { suggestSellerImportCategory } from "../lib/seller-product-import-workflow";
import { readFileSync } from "node:fs";

test("exact supplier root aliases select only a main category, while unknown paths remain unresolved", () => {
  assert.equal(suggestSellerImportMainCategory({ supplierCategory: "Home, garden and furniture" }), "home");
  assert.equal(suggestSellerImportMainCategory({ supplierCategory: "Home, garden and furniture > Unmapped" }), "home");
  assert.equal(suggestSellerImportMainCategory({ supplierCategory: "unmapped supplier taxonomy" }), null);
});

test("existing leaf recognition remains confidence-gated and preserves canonical identifiers", () => {
  const mapping = { title: "title", description: "description", category: "category" };
  const dressId = DESKTOP_CATEGORY_TAXONOMY.flatMap(category => category.groups.flatMap(group => group.items.map(leaf => ({ category, group, leaf })))).find(item => item.category.id === "women" && item.leaf === "Robes pour femmes");
  assert.ok(dressId);
  const dress = suggestSellerImportCategory({ title: "Women's dress", description: "A formal evening dress", category: subcategoryId(dressId.category.id, dressId.group.id, dressId.leaf) }, mapping);
  assert.ok(dress.canonicalCategoryId);
  assert.equal(canonicalLeafCategory(dress.canonicalCategoryId!)?.categoryId, "women");
  const weak = suggestSellerImportCategory({ title: "A shirt", description: "A comfortable shirt" }, mapping);
  assert.equal(weak.canonicalCategoryId, null);
});

test("gender evidence does not cross-map women's, men's, or children's category roots", () => {
  assert.equal(suggestSellerImportMainCategory({ title: "Men's clothing" }), "men");
  assert.equal(suggestSellerImportMainCategory({ title: "Children's clothing" }), "kids");
  assert.equal(suggestSellerImportMainCategory({ title: "Women's clothing" }), "women");
  assert.equal(suggestSellerImportMainCategory({ title: "Men's women's kids clothing" }), null);
});

test("Autre has a distinct import-only category under each parent and remains draft-only", () => {
  const ids = DESKTOP_CATEGORY_TAXONOMY.map(category => sellerImportOtherCategoryId(category.id));
  assert.equal(new Set(ids).size, DESKTOP_CATEGORY_TAXONOMY.length);
  for (const [index, category] of DESKTOP_CATEGORY_TAXONOMY.entries()) {
    assert.equal(isValidSellerImportCategoryId(category.id), true);
    assert.equal(isValidSellerImportCategoryId(ids[index]), true);
    assert.equal(canonicalLeafCategory(ids[index]), null);
    assert.equal(isCanonicalLeafCategoryId(ids[index]), false);
    assert.ok(localizedCategoryTreeValue("fr", ids[index])?.includes(localizedSellerImportMainCategory("fr", category.id)));
  }
  assert.equal(isValidSellerImportCategoryId("not-a-category"), false);
});

test("Other taxonomy labels and import copy cover all supported locales including RTL", () => {
  for (const locale of locales) {
    assert.ok(localizedSellerImportMainCategory(locale, "home"));
    assert.ok(localizedCategoryTreeValue(locale, sellerImportOtherCategoryId("home")));
    const copy = sellerImportUiCopy(locale);
    assert.ok(copy.searchCategories && copy.chooseMainCategory && copy.chooseSubcategory && copy.advancedMappings);
  }
  assert.match(readFileSync("i18n/seller-import-copy.ts", "utf8"), /ku: \{/);
});

test("import category picker and advanced mappings replace the flat category list without touching variant APIs", () => {
  const component = readFileSync("components/SellerExternalProductImport.tsx", "utf8");
  const picker = readFileSync("components/SellerImportCategoryPicker.tsx", "utf8");
  assert.match(component, /<SellerImportCategoryPicker/);
  assert.match(component, /<details className="sellerExternalImportAdvanced">/);
  assert.doesNotMatch(component, /CANONICAL_LEAF_CATEGORIES\.map/);
  assert.match(picker, /sellerImportOtherCategoryId\(category\.id\)/);
  assert.match(picker, /locales\.map\(candidate => localizedCategoryLeafLabel/);
  assert.match(component, /groupCategories/);
  assert.match(component, /confirmedRowGroups/);
});

test("category normalization handles accents, case, and supplier punctuation", () => {
  assert.equal(normalizeSellerImportCategoryText("  VÊTEMENTS  FEMMES > Robes! "), "vetements femmes robes");
});

test("draft imports may save main and import-only Other categories while public product APIs still require canonical leaves", () => {
  const service = readFileSync("lib/seller-product-import.ts", "utf8"), route = readFileSync("app/api/seller/products/import/route.ts", "utf8");
  assert.match(service, /isValidSellerImportCategoryId\(override\)/);
  assert.match(service, /isValidSellerImportCategoryId\(rowOverride\)/);
  assert.match(service, /status: "DRAFT"/);
  assert.match(service, /existing\?\.status === "PUBLISHED" && !isCanonicalLeafCategoryId\(prepared\.category\)/);
  assert.match(route, /isValidSellerImportCategoryId\(category\)/);
  assert.match(readFileSync("app/api/products/route.ts", "utf8"), /isCanonicalLeafCategoryId\(category\)/);
  assert.match(readFileSync("app/api/products/[id]/route.ts", "utf8"), /isCanonicalLeafCategoryId\(category\)/);
});
