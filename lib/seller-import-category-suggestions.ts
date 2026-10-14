import { locales } from "../i18n/config";
import { DESKTOP_CATEGORY_TAXONOMY } from "./desktop-category-taxonomy";
import { localizedSellerImportMainCategory } from "./seller-import-category-labels";

export type SellerImportCategoryEvidence = {
  supplierCategory?: string;
  title?: string;
  description?: string;
  attributes?: string | Record<string, unknown>;
};

export function normalizeSellerImportCategoryText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function attributeText(attributes?: SellerImportCategoryEvidence["attributes"]) {
  if (!attributes) return "";
  if (typeof attributes === "string") return attributes;
  return Object.entries(attributes).flatMap(([key, value]) => [key, ...(typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])]).join(" ");
}

function rootAliases(categoryId: string) {
  const category = DESKTOP_CATEGORY_TAXONOMY.find(item => item.id === categoryId);
  const commonAliases: Record<string, string[]> = {
    women: ["women", "women's clothing", "womens clothing", "ladies clothing", "women fashion"],
    pets: ["pet supplies", "pet products", "pet accessories"],
    home: ["home", "home and garden", "home garden", "home and furniture", "home decor"],
    beauty: ["beauty", "health and beauty", "beauty and hair"],
    jewelry: ["jewelry", "jewellery", "jewelry and watches", "jewellery and watches"],
    men: ["men", "men's clothing", "mens clothing", "menswear", "men fashion"],
    "bags-shoes": ["bags and shoes", "bags and footwear", "shoes and bags"],
    kids: ["kids", "children", "children's products", "children's clothing", "kids clothing", "toys kids and babies", "toys and baby"],
    sports: ["sports", "sports and outdoors", "sports and outdoor"],
    electronics: ["electronics", "consumer electronics"],
    improvement: ["home improvement", "home renovation"],
    auto: ["automotive", "cars and motorcycles", "auto parts and accessories"],
    phones: ["phones", "phones and accessories", "mobile phones and accessories"],
    computers: ["computers", "computers and office", "computer and office supplies"],
  };
  return [...new Set([
    categoryId,
    category?.slug ?? "",
    category?.label ?? "",
    ...(category?.legacyValues ?? []),
    ...(commonAliases[categoryId] ?? []),
    ...locales.map(locale => localizedSellerImportMainCategory(locale, categoryId)),
  ].filter(Boolean))];
}

function containsPhrase(text: string, phrase: string) {
  const normalizedText = ` ${normalizeSellerImportCategoryText(text)} `;
  const normalizedPhrase = normalizeSellerImportCategoryText(phrase);
  return Boolean(normalizedPhrase) && normalizedText.includes(` ${normalizedPhrase} `);
}

/** Root-only fallback. Exact taxonomy/root aliases are accepted; vague keyword similarity is not. */
export function suggestSellerImportMainCategory(input: SellerImportCategoryEvidence): string | null {
  const categories = DESKTOP_CATEGORY_TAXONOMY;
  const supplierSegments = (input.supplierCategory ?? "").split(/[>/|\\]+/).map(normalizeSellerImportCategoryText).filter(Boolean);
  const evidenceFields = [input.title ?? "", input.description ?? "", attributeText(input.attributes)].filter(Boolean);
  const matches = new Set<string>();

  for (const category of categories) {
    const aliases = rootAliases(category.id).map(normalizeSellerImportCategoryText);
    if (supplierSegments.some(segment => aliases.includes(segment))) matches.add(category.id);
    const descriptiveAliases = aliases.filter(alias => alias.split(" ").length > 1);
    if (evidenceFields.some(field => descriptiveAliases.some(alias => containsPhrase(field, alias)))) matches.add(category.id);
  }
  if (matches.size !== 1) return null;

  const categoryId = [...matches][0];
  const context = normalizeSellerImportCategoryText([input.supplierCategory ?? "", ...evidenceFields].join(" "));
  const hasWomen = /\b(women|woman|female|ladies|femme|femmes|frau|damen|kadın|женск|نسائية|زنانه|ئافرەت)\b/u.test(context);
  const hasMen = /\b(men|man|male|mens|homme|hommes|masculin|herr|herren|erkek|мужск|رجالي|مردانه|پیاو)\b/u.test(context);
  const hasChildren = /\b(kids|children|child|baby|babies|enfant|enfants|bebe|kinder|çocuk|дет|أطفال|کودک|منداڵ)\b/u.test(context);
  if (categoryId === "women" && (hasMen || hasChildren)) return null;
  if (categoryId === "men" && (hasWomen || hasChildren)) return null;
  if (categoryId === "kids" && (hasWomen || hasMen)) return null;
  return categoryId;
}
