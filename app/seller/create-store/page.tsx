import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { getLocale } from "next-intl/server";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import { sellerOnboardingDestination } from "@/lib/seller-onboarding-flow";
import { activeAccessSource } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function CreateStorePage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, query] = await Promise.all([getLocale(), searchParams]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  const session = await readSession();
  if (!session) {
    if (!intent) redirect(`/${locale}/sell#plans`);
    redirect(`/${locale}/login?next=${encodeURIComponent(sellerOnboardingPath(locale, false, intent))}`);
  }
  if (session.role === "ADMIN") redirect(`/${locale}/dashboard`);

  const [store, draft] = await Promise.all([
    prisma.store.findUnique({ where: { ownerId: session.userId }, select: { onboardingStatus: true, onboardingStep: true, subscription: { select: { status: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } }),
    prisma.sellerOnboardingDraft.findUnique({ where: { userId: session.userId }, select: { userId: true } }),
  ]);
  const entitlementSource = store ? activeAccessSource(store).source : "NONE";
  redirect(sellerOnboardingDestination({ locale, intent, hasStore: Boolean(store), hasDraft: Boolean(draft), onboardingStatus: store?.onboardingStatus, onboardingStep: store?.onboardingStep, entitlementSource }));
}
