import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, localeCookie, locales, type Locale } from "./i18n/config";

const countryLocales: Record<string, Locale> = { FR: "fr", BE: "fr", CA: "fr", DZ: "ar", MA: "ar", TN: "ar", EG: "ar", IQ: "ar", JO: "ar", SA: "ar", TR: "tr", DE: "de", AT: "de", CH: "de", ES: "es", MX: "es", IT: "it", NL: "nl" };

function detectLocale(request: NextRequest): Locale {
  const remembered = request.cookies.get(localeCookie)?.value;
  if (isLocale(remembered)) return remembered;
  const preferred = request.headers.get("accept-language")?.split(",").map((part) => part.trim().split(";", 1)[0].toLowerCase());
  for (const language of preferred ?? []) {
    const exact = language === "ckb" ? "ku" : language.split("-")[0];
    if (isLocale(exact)) return exact;
  }
  const country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
  return (country && countryLocales[country.toUpperCase()]) || defaultLocale;
}

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const pathLocale = segments[0];
  if (!isLocale(pathLocale)) {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${segments.slice(1).join("/")}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-todijo-locale", pathLocale);
  requestHeaders.set("x-todijo-pathname", request.nextUrl.pathname);
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  if (request.cookies.get(localeCookie)?.value !== pathLocale) {
    response.cookies.set(localeCookie, pathLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  return response;
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
