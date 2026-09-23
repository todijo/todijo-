import { NextResponse } from "next/server";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { DESKTOP_CATEGORY_TAXONOMY, subcategoryId } from "@/lib/desktop-category-taxonomy";
import { categoryNavigationMessages } from "@/i18n/category-navigation";
import { localizedCategoryGroupLabel, localizedCategoryLeafLabel } from "@/lib/category-tree-localization";
import { isLocale } from "@/i18n/config";

export async function GET(request: Request) {
  try {
    await requireMobileSeller(request);
    const requested = new URL(request.url).searchParams.get("locale");
    const locale = isLocale(requested) ? requested : "fr";
    const labels = categoryNavigationMessages[locale];
    const categories = DESKTOP_CATEGORY_TAXONOMY.map(category => ({
      id: category.id,
      label: labels[category.id as keyof typeof labels] ?? category.label,
      groups: category.groups.map(group => ({
        id: group.id,
        label: localizedCategoryGroupLabel(locale, category.id, group.id, group.label),
        children: group.items.map(label => ({
          id: subcategoryId(category.id, group.id, label),
          label: localizedCategoryLeafLabel(locale, category.id, group.id, label),
        })),
      })),
    }));
    return NextResponse.json({ locale, categories }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
