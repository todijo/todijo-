export const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "TODIJO_LOCALE";
export const rtlLocales = new Set<Locale>(["ar", "fa", "ku"]);

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}
