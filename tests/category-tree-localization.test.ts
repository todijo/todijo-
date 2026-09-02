import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../i18n/config";
import { CATEGORY_LABELS, categoryGroupTranslationKey, categoryLeafTranslationKey } from "../lib/category-locales";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref, subcategoryId } from "../lib/desktop-category-taxonomy";
import {
  categoryGroupTranslationSource,
  categoryLeafTranslationSource,
  localizedCategoryGroupLabel,
  localizedCategoryLeafLabel,
  localizedCategoryTreeValue,
} from "../lib/category-tree-localization";

const samples = [
  ["women", "outerwear", "Vêtements d'extérieur et Vestes", "Vestes matelassées pour femmes"],
  ["pets", "outdoor", "Fournitures d'extérieur pour animaux de compagnie", "Sacs pour animaux de compagnie"],
  ["jewelry", "fashion", "Bijoux à la mode", "Boucles d'oreilles"],
  ["kids", "boys", "Vêtements pour garçons", "Vêtements d'extérieur et Manteaux"],
  ["electronics", "smart", "Électronique intelligente", "Montres"],
] as const;

test("French canonical category identity remains unchanged", () => {
  for (const [categoryId, groupId, group, leaf] of samples) {
    assert.equal(localizedCategoryGroupLabel("fr", categoryId, groupId, group), group);
    assert.equal(localizedCategoryLeafLabel("fr", categoryId, groupId, leaf), leaf);
    assert.equal(categorySearchHref("en", leaf), `/en/search?category=${encodeURIComponent(leaf)}`);
    assert.ok(subcategoryId(categoryId, groupId, leaf).startsWith(`${categoryId}--${groupId}--`));
  }
});

test("English and Arabic localize representative groups and leaves without changing selection values", () => {
  assert.equal(localizedCategoryGroupLabel("en", "women", "outerwear", samples[0][2]), "Outerwear & Jackets");
  assert.equal(localizedCategoryGroupLabel("en", "jewelry", "fashion", samples[2][2]), "Fashion Jewelry");
  assert.equal(localizedCategoryGroupLabel("en", "kids", "boys", samples[3][2]), "Boys' Clothing");
  assert.equal(localizedCategoryLeafLabel("en", "electronics", "smart", "Montres"), "Smart Watches");
  assert.equal(localizedCategoryGroupLabel("ar", "women", "outerwear", samples[0][2]), "الملابس الخارجية والسترات");
  assert.equal(localizedCategoryLeafLabel("ar", "kids", "boys", samples[3][3]), "الملابس الخارجية والمعاطف");
});

test("all supported non-French locales resolve representative tree labels without French leakage", () => {
  for (const locale of locales.filter((item) => item !== "fr")) {
    for (const [categoryId, groupId, group, leaf] of samples) {
      assert.notEqual(localizedCategoryGroupLabel(locale, categoryId, groupId, group), group, `${locale} group leaked French`);
      assert.notEqual(localizedCategoryLeafLabel(locale, categoryId, groupId, leaf), leaf, `${locale} leaf leaked French`);
    }
  }
});

test("every canonical leaf has a non-French English display label and shared value resolver", () => {
  for (const category of DESKTOP_CATEGORY_TAXONOMY) for (const group of category.groups) for (const leaf of group.items) {
    const display = localizedCategoryLeafLabel("en", category.id, group.id, leaf);
    assert.ok(display.trim());
    if (/[àâçéèêëîïôùûüœ]|\b(pour|femme|homme|vêtements|chaussures|bijoux|montres)\b/i.test(leaf)) assert.notEqual(display, leaf, `French leakage: ${category.id}/${group.id}/${leaf}`);
    assert.equal(localizedCategoryTreeValue("en", subcategoryId(category.id, group.id, leaf)), display);
  }
});

test("every non-French locale has an explicit label for all 75 groups and 447 leaves", () => {
  const expectedKeys = new Set<string>();
  for (const category of DESKTOP_CATEGORY_TAXONOMY) for (const group of category.groups) {
    expectedKeys.add(categoryGroupTranslationKey(category.id, group.id));
    for (const leaf of group.items) expectedKeys.add(categoryLeafTranslationKey(subcategoryId(category.id, group.id, leaf)));
  }
  assert.equal([...expectedKeys].filter((key) => key.startsWith("group:")).length, 75);
  assert.equal([...expectedKeys].filter((key) => key.startsWith("leaf:")).length, 447);

  for (const locale of locales.filter((item) => item !== "fr")) {
    const corpus = CATEGORY_LABELS[locale];
    assert.deepEqual(new Set(Object.keys(corpus)), expectedKeys, `${locale} corpus must exactly cover the canonical tree`);
    for (const [key, label] of Object.entries(corpus)) assert.ok(label.trim(), `${locale}/${key} is empty`);
  }
});

test("known category nodes never use a fallback in any supported locale", () => {
  for (const locale of locales.filter((item) => item !== "fr")) {
    for (const category of DESKTOP_CATEGORY_TAXONOMY) for (const group of category.groups) {
      assert.equal(categoryGroupTranslationSource(locale, category.id, group.id), "explicit");
      for (const leaf of group.items) {
        assert.equal(categoryLeafTranslationSource(locale, category.id, group.id, leaf), "explicit");
        const id = subcategoryId(category.id, group.id, leaf);
        assert.equal(localizedCategoryTreeValue(locale, id), localizedCategoryLeafLabel(locale, category.id, group.id, leaf));
        assert.equal(categorySearchHref(locale, id), `/${locale}/search?category=${encodeURIComponent(id)}`);
      }
    }
  }
});

test("unknown nodes fail safely without changing their canonical identity", () => {
  assert.equal(localizedCategoryGroupLabel("en", "future", "group", "Libellé futur"), "Libellé futur");
  assert.equal(categoryGroupTranslationSource("en", "future", "group"), "unknown-node");
  assert.equal(localizedCategoryLeafLabel("xx", "future", "group", "Libellé futur"), "Libellé futur");
});
