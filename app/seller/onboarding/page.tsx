import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { defaultBuyerAddress } from "@/lib/buyer-addresses";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import { sellerOnboardingDestination } from "@/lib/seller-onboarding-flow";
import { activeAccessSource } from "@/lib/admin-access";
import SellerOnboardingForm from "./SellerAddressOnboardingForm";
import { isLocale } from "@/i18n/config";
import { sellerOnboardingJourneyCopy } from "@/i18n/seller-onboarding-journey";
import { sellerPlanEntitlement } from "@/lib/seller-plans";

export const dynamic = "force-dynamic";

export default async function SellerOnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, query, session] = await Promise.all([getLocale(), searchParams, readSession()]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  if (!session) {
    redirect(`/${locale}/login?next=${encodeURIComponent(intent ? sellerOnboardingPath(locale, false, intent) : `/${locale}/seller/onboarding`)}`);
  }
  if(session.role==="ADMIN") redirect(`/${locale}/dashboard`);
  const [user, buyerAddress] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { sellerOnboardingDraft:true, store: { select: { name: true, country: true, city: true, phone: true, businessAddress: true, businessPostalCode: true, sellerType: true, sellerLegalForm: true, companySubtype: true, businessRegistrationId: true, legalBusinessName: true, vatStatus: true, vatNumber: true, onboardingStatus: true, onboardingStep: true, subscription: { select: { status: true, plan: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } } } }),
    defaultBuyerAddress(prisma, session.userId),
  ]);
  if (!user) redirect(`/${locale}/login`);
  const store = user.store, draft = user.sellerOnboardingDraft;
  const entitlementSource = store ? activeAccessSource(store).source : "NONE";
  const destination = sellerOnboardingDestination({ locale, intent, hasStore: Boolean(store), hasDraft: Boolean(draft), onboardingStatus: store?.onboardingStatus, onboardingStep: store?.onboardingStep, entitlementSource });
  if (!destination.startsWith(`/${locale}/seller/onboarding`)) redirect(destination);
  const journeyCopy=sellerOnboardingJourneyCopy(isLocale(locale)?locale:"en"),selectedPlan=intent?sellerPlanEntitlement(intent.plan):null;
  return <SellerOnboardingForm journeyCopy={journeyCopy} selectedPlan={selectedPlan&&intent?{name:selectedPlan.name,interval:intent.interval,amountMinor:intent.interval==="monthly"?selectedPlan.monthlyAmountMinor:selectedPlan.annualAmountMinor,currency:selectedPlan.currency}:null} sellerIntent={intent} buyerAddress={buyerAddress ? { address: [buyerAddress.addressLine1, buyerAddress.addressLine2].filter(Boolean).join(", "), postalCode: buyerAddress.postalCode, city: buyerAddress.city, country: buyerAddress.country, phone: buyerAddress.phone ?? "" } : null} initial={{ storeName: store?.name ?? draft?.storeName ?? "", country: store?.country ?? draft?.country ?? "", city: store?.city ?? draft?.city ?? "", phone: store?.phone ?? draft?.phone ?? "", address: store?.businessAddress ?? draft?.address ?? "", postalCode: store?.businessPostalCode ?? draft?.postalCode ?? "", sellerType: (store?.sellerType ?? draft?.sellerType) === "PROFESSIONAL" ? "PROFESSIONAL" : "PRIVATE", legalForm: store?.sellerLegalForm ?? draft?.legalForm ?? "", companySubtype: store?.companySubtype ?? draft?.companySubtype ?? "", businessRegistrationNumber: store?.businessRegistrationId ?? draft?.businessRegistrationNumber ?? "", legalBusinessName: store?.legalBusinessName ?? draft?.legalBusinessName ?? "", vatStatus: store?.vatStatus ?? draft?.vatStatus ?? "UNKNOWN", vatNumber: store?.vatNumber ?? draft?.vatNumber ?? "" }} />;
}
