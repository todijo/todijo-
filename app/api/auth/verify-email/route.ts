import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";
import { localizedHome, safeLoginDestination } from "@/lib/auth-redirects";
import { publicAppUrl } from "@/lib/email/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeValue=url.searchParams.get("locale"),locale = isLocale(localeValue) ? localeValue : defaultLocale;
  const status = await consumeEmailVerificationToken(url.searchParams.get("token") ?? "");
  const destination = new URL(`${localizedHome(locale)}/verify-email`, publicAppUrl());
  destination.searchParams.set("status", status);
  const next=url.searchParams.get("next");
  if(next)destination.searchParams.set("next",safeLoginDestination(next,locale));
  return NextResponse.redirect(destination, 303);
}
