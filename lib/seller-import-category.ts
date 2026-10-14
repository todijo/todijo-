import { DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, isCanonicalLeafCategoryId } from "./desktop-category-taxonomy";

const IMPORT_OTHER_SUFFIX = "--seller-import-other--other";

export function sellerImportOtherCategoryId(categoryId: string) {
  return DESKTOP_CATEGORY_TAXONOMY.some(category => category.id === categoryId) ? `${categoryId}${IMPORT_OTHER_SUFFIX}` : "";
}

export function sellerImportOtherParent(value: string) {
  const category = DESKTOP_CATEGORY_TAXONOMY.find(item => value === `${item.id}${IMPORT_OTHER_SUFFIX}`);
  return category?.id ?? null;
}

export function isValidSellerImportCategoryId(value: string) {
  return DESKTOP_CATEGORY_TAXONOMY.some(category => category.id === value) || isCanonicalLeafCategoryId(value) || sellerImportOtherParent(value) !== null;
}

export function sellerImportCategoryRootId(value: string) {
  return DESKTOP_CATEGORY_TAXONOMY.some(category => category.id === value) ? value : canonicalLeafCategory(value)?.categoryId ?? sellerImportOtherParent(value);
}
