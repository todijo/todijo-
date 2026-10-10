import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import RegisterForm from "./RegisterForm";
import { localizedHome, safeLoginDestination } from "@/lib/auth-redirects";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import type { Locale } from "@/i18n/config";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; plan?: string; interval?: string; next?: string }> }) {
  const [session, localeValue, query] = await Promise.all([readSession(), getLocale(), searchParams]);
  const locale = localeValue as Locale;
  const intent = query.role === "seller" ? explicitSellerRegistrationIntent(query.plan, query.interval) : null;
  if (session) {
    if (session.role === "ADMIN") redirect(localizedHome(locale));
    if (query.role === "seller") {
      const store = await prisma.store.findFirst({ where: { ownerId: session.userId }, select: { id: true } });
      redirect(sellerOnboardingPath(locale, Boolean(store), intent));
    }
    redirect(query.next ? safeLoginDestination(query.next, locale) : `/${locale}/dashboard`);
  }
  const turnstileSiteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "";
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm turnstileSiteKey={turnstileSiteKey} /></Suspense>;
}
