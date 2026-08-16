import { defaultLocale, isLocale, type Locale } from "../i18n/config";

export function localizedHome(locale: string | null | undefined) {
  return `/${isLocale(locale) ? locale : defaultLocale}`;
}

export function adminEntryPath(locale: Locale) {
  return `/${locale}/admin`;
}

export function safeLoginDestination(next: string | null, locale: Locale) {
  if (!next || /[\u0000-\u001f\u007f]/.test(next)) return localizedHome(locale);
  try {
    const decoded = decodeURIComponent(next);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return localizedHome(locale);
    const url = new URL(next, "https://todijo.invalid");
    if (url.origin !== "https://todijo.invalid" || url.pathname.startsWith("/api/")) return localizedHome(locale);
    const segments = url.pathname.split("/").filter(Boolean);
    const path = isLocale(segments[0]) ? `/${segments.slice(1).join("/")}` : url.pathname;
    return `${localizedHome(locale)}${path === "/" ? "" : path}${url.search}${url.hash}`;
  } catch {
    return localizedHome(locale);
  }
}

export function postLoginDestination(role: "CUSTOMER" | "SELLER" | "ADMIN" | undefined, next: string | null, locale: Locale) {
  return role === "ADMIN" ? adminEntryPath(locale) : safeLoginDestination(next, locale);
}

export function localeFromReferer(referer: string | null) {
  if (!referer) return defaultLocale;
  try {
    const candidate = new URL(referer).pathname.split("/").filter(Boolean)[0];
    return isLocale(candidate) ? candidate : defaultLocale;
  } catch {
    return defaultLocale;
  }
}
