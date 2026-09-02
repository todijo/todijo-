import { isLocale } from "../i18n/config";
import { CATEGORY_LABELS, categoryGroupTranslationKey, categoryLeafTranslationKey, type TranslatedCategoryLocale } from "./category-locales";
import { DESKTOP_CATEGORY_TAXONOMY, subcategoryId } from "./desktop-category-taxonomy";

export type CategoryTranslationSource = "canonical-fr" | "explicit" | "unknown-locale" | "unknown-node";

function translatedLabel(locale: string, key: string, canonicalLabel: string): [string, CategoryTranslationSource] {
  if (locale === "fr") return [canonicalLabel, "canonical-fr"];
  if (!isLocale(locale)) return [canonicalLabel, "unknown-locale"];
  const label = CATEGORY_LABELS[locale as TranslatedCategoryLocale][key];
  return label ? [label, "explicit"] : [canonicalLabel, "unknown-node"];
}

export function localizedCategoryGroupLabel(locale: string, categoryId: string, groupId: string, canonicalLabel: string) {
  return translatedLabel(locale, categoryGroupTranslationKey(categoryId, groupId), canonicalLabel)[0];
}

export function localizedCategoryLeafLabel(locale: string, categoryId: string, groupId: string, canonicalLabel: string) {
  const leafId = subcategoryId(categoryId, groupId, canonicalLabel);
  return translatedLabel(locale, categoryLeafTranslationKey(leafId), canonicalLabel)[0];
}

export function categoryGroupTranslationSource(locale: string, categoryId: string, groupId: string) {
  return translatedLabel(locale, categoryGroupTranslationKey(categoryId, groupId), "")[1];
}

export function categoryLeafTranslationSource(locale: string, categoryId: string, groupId: string, canonicalLabel: string) {
  const leafId = subcategoryId(categoryId, groupId, canonicalLabel);
  return translatedLabel(locale, categoryLeafTranslationKey(leafId), "")[1];
}

export function localizedCategoryTreeValue(locale: string, value: string) {
  for (const category of DESKTOP_CATEGORY_TAXONOMY) {
    for (const group of category.groups) {
      if (value === group.label) return localizedCategoryGroupLabel(locale, category.id, group.id, group.label);
      const leaf = group.items.find((item) => item === value || subcategoryId(category.id, group.id, item) === value);
      if (leaf) return localizedCategoryLeafLabel(locale, category.id, group.id, leaf);
    }
  }
  return null;
}
