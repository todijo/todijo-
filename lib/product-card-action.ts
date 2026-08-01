import { type Locale } from "@/i18n/config";
import { buildLocalizedPath } from "./locale-routing";

export type ProductCardAction = "ADD_TO_CART" | "CHOOSE_OPTIONS" | "SOLD_OUT";

export function resolveProductCardAction(input: { hasActiveVariants: boolean; isGenerallyAvailable: boolean }): ProductCardAction {
  if (!input.isGenerallyAvailable) return "SOLD_OUT";
  return input.hasActiveVariants ? "CHOOSE_OPTIONS" : "ADD_TO_CART";
}

export function productCardOptionHref(productId: string, locale: Locale) {
  return buildLocalizedPath(`/product/${productId}`, locale);
}
