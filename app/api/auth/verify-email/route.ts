import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";
import { localizedHome } from "@/lib/auth-redirects";
import { publicAppUrl } from "@/lib/email/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = isLocale(url.searchParams.get("locale")) ? url.searchParams.get("locale")! : defaultLocale;
  const status = await consumeEmailVerificationToken(url.searchParams.get("token") ?? "");
  const destination = new URL(`${localizedHome(locale)}/verify-email`, publicAppUrl());
  destination.searchParams.set("status", status);
  return NextResponse.redirect(destination, 303);
}
