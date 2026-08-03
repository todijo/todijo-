import { isLocale } from "../i18n/config";

function cleanPath(value: string) {
  const path = value.split(/[?#]/, 1)[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function pathWithoutLocale(pathname: string) {
  const path = cleanPath(pathname);
  const segments = path.split("/").filter(Boolean);
  if (isLocale(segments[0])) segments.shift();
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function localizedPath(locale: string, path = "/") {
  const suffix = pathWithoutLocale(path);
  return suffix === "/" ? `/${locale}` : `/${locale}${suffix}`;
}

export function isNavigationActive(pathname: string, target: string, nested = false) {
  const current = pathWithoutLocale(pathname);
  const destination = pathWithoutLocale(target);
  if (destination === "/") return current === "/";
  return current === destination || (nested && current.startsWith(`${destination}/`));
}

export function navigationBackFallback(pathname: string, locale: string) {
  const path = pathWithoutLocale(pathname);
  if (path.startsWith("/seller/")) return localizedPath(locale, "/dashboard");
  if (path.startsWith("/dashboard") || path.startsWith("/account/")) return localizedPath(locale, "/dashboard");
  if (path.startsWith("/verify-email") || path.startsWith("/reset-password") || path.startsWith("/forgot-password")) return localizedPath(locale, "/login");
  return localizedPath(locale);
}
