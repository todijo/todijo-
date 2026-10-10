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
import { resolveSellerPersonalAddress } from "@/lib/seller-onboarding-address";

export const dynamic = "force-dynamic";

export default async function SellerOnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, query, session] = await Promise.all([getLocale(), searchParams, readSession()]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  if (!session) {
    console.info("[dashboard-trace]",JSON.stringify({phase:"seller-onboarding-redirect",reason:"no-session"}));
    redirect(`/${locale}/login?next=${encodeURIComponent(intent ? sellerOnboardingPath(locale, false, intent) : `/${locale}/seller/onboarding`)}`);
  }
  if(session.role==="ADMIN"){console.info("[dashboard-trace]",JSON.stringify({phase:"seller-onboarding-redirect",reason:"admin",target:`/${locale}/dashboard`}));redirect(`/${locale}/dashboard`);}
  const [user, buyerAddress] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { email:true,phone:true,profileAddress:true,profilePostalCode:true,profileCity:true,profileCountry:true,sellerOnboardingDraft:true, ownedBusiness:{select:{siren:true,inseeVerificationState:true}}, store: { select: { name: true, country: true, city: true, phone: true, businessAddress: true, businessPostalCode: true, displayBusinessAddress:true, samePersonalBusinessAddress:true, business:{select:{siren:true,inseeVerificationState:true}}, sellerType: true, sellerLegalForm: true, companySubtype: true, businessRegistrationId: true, legalBusinessName: true, vatStatus: true, vatNumber: true, onboardingStatus: true, onboardingStep: true, subscription: { select: { status: true, plan: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } } } }),
    defaultBuyerAddress(prisma, session.userId),
  ]);
  if (!user){console.info("[dashboard-trace]",JSON.stringify({phase:"seller-onboarding-redirect",reason:"no-user",target:`/${locale}/login`}));redirect(`/${locale}/login`);}
  const store = user.store, draft = user.sellerOnboardingDraft;
  const personalAddress = resolveSellerPersonalAddress(buyerAddress, user);
  const entitlementSource = store ? activeAccessSource(store).source : "NONE";
  const destination = sellerOnboardingDestination({ locale, intent, hasStore: Boolean(store), hasDraft: Boolean(draft), onboardingStatus: store?.onboardingStatus, onboardingStep: store?.onboardingStep, entitlementSource });
  console.info("[dashboard-trace]",JSON.stringify({phase:"seller-onboarding-state",role:session.role,hasStore:Boolean(store),hasDraft:Boolean(draft),onboardingStatus:store?.onboardingStatus??null,onboardingStep:store?.onboardingStep??null,entitlementSource,destination}));
  if (!destination.startsWith(`/${locale}/seller/onboarding`)){console.info("[dashboard-trace]",JSON.stringify({phase:"seller-onboarding-redirect",reason:"destination",target:destination}));redirect(destination);}
  const journeyCopy=sellerOnboardingJourneyCopy(isLocale(locale)?locale:"en"),selectedPlan=intent?sellerPlanEntitlement(intent.plan):null;
  const samePersonalBusinessAddress = store?.samePersonalBusinessAddress ?? draft?.samePersonalBusinessAddress ?? false;
  const step = Math.max(1, Math.min(4, draft?.step ?? store?.onboardingStep ?? 1));
  return <SellerOnboardingForm journeyCopy={journeyCopy} selectedPlan={selectedPlan&&intent?{name:selectedPlan.name,interval:intent.interval,amountMinor:intent.interval==="monthly"?selectedPlan.monthlyAmountMinor:selectedPlan.annualAmountMinor,currency:selectedPlan.currency}:null} sellerIntent={intent} buyerAddress={personalAddress} initial={{ storeName: store?.name ?? draft?.storeName ?? "", contactEmail:user.email, country: store?.country ?? draft?.country ?? personalAddress?.country ?? user.profileCountry ?? "", city: store?.city ?? draft?.city ?? personalAddress?.city ?? user.profileCity ?? "", phone: store?.phone ?? draft?.phone ?? user.phone ?? "", address: store?.businessAddress ?? draft?.address ?? personalAddress?.address ?? user.profileAddress ?? "", postalCode: store?.businessPostalCode ?? draft?.postalCode ?? personalAddress?.postalCode ?? user.profilePostalCode ?? "", sellerType: (store?.sellerType ?? draft?.sellerType) === "PROFESSIONAL" ? "PROFESSIONAL" : (store?.sellerType ?? draft?.sellerType) === "PRIVATE" ? "PRIVATE" : "", legalForm: store?.sellerLegalForm ?? draft?.legalForm ?? "", companySubtype: store?.companySubtype ?? draft?.companySubtype ?? "", businessSiren: store?.business?.siren ?? user.ownedBusiness?.siren ?? draft?.businessSiren ?? "", businessRegistrationNumber: store?.businessRegistrationId ?? draft?.businessRegistrationNumber ?? "", legalBusinessName: store?.legalBusinessName ?? draft?.legalBusinessName ?? "", vatStatus: store?.vatStatus ?? draft?.vatStatus ?? "UNKNOWN", vatNumber: store?.vatNumber ?? draft?.vatNumber ?? "", displayBusinessAddress:store?.displayBusinessAddress??draft?.displayBusinessAddress??false, samePersonalBusinessAddress, step, businessVerificationState:store?.business?.inseeVerificationState??user.ownedBusiness?.inseeVerificationState??"NOT_STARTED" }} />;
}
