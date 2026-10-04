import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import RegisterForm from "./RegisterForm";
import { localizedHome } from "@/lib/auth-redirects";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; plan?: string; interval?: string }> }) {
  const [session, locale, query] = await Promise.all([readSession(), getLocale(), searchParams]);
  const intent = query.role === "seller" ? explicitSellerRegistrationIntent(query.plan, query.interval) : null;
  if (session) {
    if (intent && session.role !== "ADMIN") {
      const store = await prisma.store.findFirst({ where: { ownerId: session.userId }, select: { id: true } });
      redirect(sellerOnboardingPath(locale, Boolean(store), intent));
    }
    redirect(localizedHome(locale));
  }
  const turnstileSiteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "";
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm turnstileSiteKey={turnstileSiteKey} /></Suspense>;
}
