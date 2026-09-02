import type { Locale } from "../../i18n/config";
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
export const CATEGORY_LABELS: Record<TranslatedCategoryLocale, Record<string, string>> = {
  en: enCategoryLabels, ar: arCategoryLabels, ku: kuCategoryLabels, tr: trCategoryLabels,
  de: deCategoryLabels, es: esCategoryLabels, it: itCategoryLabels, nl: nlCategoryLabels,
  zh: zhCategoryLabels, fa: faCategoryLabels, hi: hiCategoryLabels, pt: ptCategoryLabels,
  ru: ruCategoryLabels,
};

export const categoryGroupTranslationKey = (categoryId: string, groupId: string) => `group:${categoryId}:${groupId}`;
export const categoryLeafTranslationKey = (leafId: string) => `leaf:${leafId}`;
