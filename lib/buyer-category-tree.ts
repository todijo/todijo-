import { categoryNavigationMessages } from "@/i18n/category-navigation";
import { MARKETPLACE_CATEGORY_TAXONOMY } from "@/lib/marketplace-category-taxonomy";
import { localizedCategoryGroupLabel, localizedCategoryLeafLabel } from "@/lib/category-tree-localization";
import { subcategoryId, subcategoryImagePath } from "@/lib/desktop-category-taxonomy";
import type { Locale } from "@/i18n/config";

export function buyerCategoryTree(locale: Locale) {
  const labels = categoryNavigationMessages[locale];
  return MARKETPLACE_CATEGORY_TAXONOMY.map((category) => ({
    id: category.id, slug: category.slug, label: labels[category.id as keyof typeof labels] ?? category.label, iconKey: category.iconKey,
    groups: category.groups.map((group) => ({
      id: group.id, label: localizedCategoryGroupLabel(locale, category.id, group.id, group.label),
      children: group.items.map((canonicalLabel) => ({ id: subcategoryId(category.id, group.id, canonicalLabel), label: localizedCategoryLeafLabel(locale, category.id, group.id, canonicalLabel), image: subcategoryImagePath(category.id, group.id, canonicalLabel) })),
    })),
  }));
}
