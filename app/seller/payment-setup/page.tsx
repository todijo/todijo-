import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner } from "@/lib/seller-business-access";
import { sellerBusinessCommercialEntitlement } from "@/lib/seller-business";
import { isLocale } from "@/i18n/config";
import { sellerOnboardingJourneyCopy } from "@/i18n/seller-onboarding-journey";
import StripeConnectSection from "@/components/StripeConnectSection";
import TodijoLogo from "@/components/TodijoLogo";

export const dynamic="force-dynamic";

export default async function SellerPaymentSetupPage(){
  const [localeValue,session]=await Promise.all([getLocale(),readSession()]),locale=isLocale(localeValue)?localeValue:"en";
  if(!session)redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/seller/payment-setup`)}`);
  let principal;try{principal=await requireBusinessOwner(prisma,session.userId)}catch{redirect(`/${locale}/sell#plans`)}
  const [entitlement,user]=await Promise.all([sellerBusinessCommercialEntitlement(prisma,principal.businessId),prisma.user.findUnique({where:{id:session.userId},select:{stripeAccountId:true,stripeOnboardingComplete:true,stripeChargesEnabled:true,stripePayoutsEnabled:true}})]);
  if(!entitlement.active)redirect(`/${locale}/seller/subscription`);
  if(!user)redirect(`/${locale}/login`);
  const ready=Boolean(user.stripeAccountId&&user.stripeOnboardingComplete&&user.stripeChargesEnabled&&user.stripePayoutsEnabled);
  if(ready)redirect(`/${locale}/dashboard`);
  const copy=sellerOnboardingJourneyCopy(locale);
  return <main className="sellerOnboardingPage"><div className="sellerJourneyBrand"><TodijoLogo href={`/${locale}`}/><div><strong>{copy.paymentTitle}</strong><p>{copy.paymentIntro}</p></div></div><ol className="sellerJourneyProgress"><li className="isComplete">✓ <span>{copy.account}</span></li><li className="isComplete">✓ <span>{copy.information}</span></li><li className="isComplete">✓ <span>{copy.subscription}</span></li><li className="isCurrent">4 <span>{copy.paymentSetup}</span></li><li>5 <span>{copy.ready}</span></li></ol><section className="sellerOnboardingCard"><StripeConnectSection commercialEntitlementActive initialStatus={{connected:Boolean(user.stripeAccountId),onboardingComplete:user.stripeOnboardingComplete,chargesEnabled:user.stripeChargesEnabled,payoutsEnabled:user.stripePayoutsEnabled}}/></section></main>;
}
