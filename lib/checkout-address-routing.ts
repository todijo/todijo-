import type { Locale } from "@/i18n/config";

export function checkoutPath(locale: Locale | string) {
  return `/${locale}/checkout`;
}

export function checkoutAddressPath(locale: Locale | string) {
  return `/${locale}/account/addresses?next=${encodeURIComponent(checkoutPath(locale))}`;
}

export function safeCheckoutReturnPath(locale: Locale | string, value: unknown) {
  return typeof value === "string" && value === checkoutPath(locale) ? value : null;
}
