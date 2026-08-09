import { locales, type Locale } from "../i18n/config";

export function siteUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function localizedPath(locale: string, pathname = "") {
  const suffix = pathname && pathname !== "/" ? `/${pathname.replace(/^\/+|\/+$/g, "")}` : "";
  return `/${locale}${suffix}`;
}

export function localizedAlternates(locale: Locale, pathname = "") {
  return {
    canonical: localizedPath(locale, pathname),
    languages: Object.fromEntries(locales.map((item) => [item, localizedPath(item, pathname)])),
  };
}

export function concise(value: string, max = 160) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
