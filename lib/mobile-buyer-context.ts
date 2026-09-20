import { isLocale, type Locale } from "@/i18n/config";

export function mobileBuyerLocale(request: Request): Locale {
  const url = new URL(request.url);
  const explicit = url.searchParams.get("locale")?.trim().toLowerCase();
  if (isLocale(explicit)) return explicit;
  const header = request.headers.get("x-todijo-locale")?.trim().toLowerCase();
  if (isLocale(header)) return header;
  const accepted = request.headers.get("accept-language")?.split(",", 1)[0]?.split("-", 1)[0]?.trim().toLowerCase();
  return isLocale(accepted) ? accepted : "en";
}
