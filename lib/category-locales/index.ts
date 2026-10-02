import type { Locale } from "../../i18n/config";
import { furnitureTaxonomyLabels } from "../../i18n/furniture-taxonomy";
import { subcategoryId } from "../desktop-category-taxonomy";
import { arCategoryLabels } from "./ar";
import { deCategoryLabels } from "./de";
import { enCategoryLabels } from "./en";
import { esCategoryLabels } from "./es";
import { faCategoryLabels } from "./fa";
import { hiCategoryLabels } from "./hi";
import { itCategoryLabels } from "./it";
import { kuCategoryLabels } from "./ku";
import { nlCategoryLabels } from "./nl";
import { ptCategoryLabels } from "./pt";
import { ruCategoryLabels } from "./ru";
import { trCategoryLabels } from "./tr";
import { zhCategoryLabels } from "./zh";

export type TranslatedCategoryLocale = Exclude<Locale, "fr">;
function withFurnitureLabels(locale: TranslatedCategoryLocale, labels: Record<string, string>): Record<string, string> {
  const furniture = furnitureTaxonomyLabels[locale];
  return {
    ...labels,
    "group:home:furniture": furniture[0],
    ...Object.fromEntries(furnitureTaxonomyLabels.fr.slice(1).map((label, index) => [
      `leaf:${subcategoryId("home", "furniture", label)}`, furniture[index + 1],
    ])),
  };
}

export const CATEGORY_LABELS: Record<TranslatedCategoryLocale, Record<string, string>> = {
  en: withFurnitureLabels("en", enCategoryLabels), ar: withFurnitureLabels("ar", arCategoryLabels), ku: withFurnitureLabels("ku", kuCategoryLabels), tr: withFurnitureLabels("tr", trCategoryLabels),
  de: withFurnitureLabels("de", deCategoryLabels), es: withFurnitureLabels("es", esCategoryLabels), it: withFurnitureLabels("it", itCategoryLabels), nl: withFurnitureLabels("nl", nlCategoryLabels),
  zh: withFurnitureLabels("zh", zhCategoryLabels), fa: withFurnitureLabels("fa", faCategoryLabels), hi: withFurnitureLabels("hi", hiCategoryLabels), pt: withFurnitureLabels("pt", ptCategoryLabels),
  ru: withFurnitureLabels("ru", ruCategoryLabels),
};

export const categoryGroupTranslationKey = (categoryId: string, groupId: string) => `group:${categoryId}:${groupId}`;
export const categoryLeafTranslationKey = (leafId: string) => `leaf:${leafId}`;
