import { isLocale, type Locale } from "../i18n/config";

function pathnameSegments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

export function buildLocalizedPath(pathname: string, locale: Locale, search = "", hash = "") {
  const segments = pathnameSegments(pathname);
  while (isLocale(segments[0])) segments.shift();

  const suffix = segments.length ? `/${segments.join("/")}` : "";
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return `/${locale}${suffix}${query}${fragment}`;
}

export function canonicalizeNestedLocalePath(pathname: string) {
  const segments = pathnameSegments(pathname);
  const leadingLocales: Locale[] = [];

  while (isLocale(segments[leadingLocales.length])) {
    leadingLocales.push(segments[leadingLocales.length] as Locale);
  }

  if (leadingLocales.length < 2) return null;
  return buildLocalizedPath(`/${segments.slice(leadingLocales.length).join("/")}`, leadingLocales.at(-1)!);
}
