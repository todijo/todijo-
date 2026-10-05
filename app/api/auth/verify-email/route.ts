import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";
import { localizedHome, safeLoginDestination } from "@/lib/auth-redirects";
import { publicAppUrl } from "@/lib/email/config";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sellerOnboardingDestination } from "@/lib/seller-onboarding-flow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeValue=url.searchParams.get("locale"),locale = isLocale(localeValue) ? localeValue : defaultLocale;
  const result = await consumeEmailVerificationToken(url.searchParams.get("token") ?? "");
  const nextValue=url.searchParams.get("next");
  if(result.status==="success"&&result.userId){
    const user=await prisma.user.findUnique({where:{id:result.userId},select:{role:true,store:{select:{id:true,onboardingStatus:true,onboardingStep:true}},sellerOnboardingDraft:{select:{id:true}}}});
    const continuation=nextValue?safeLoginDestination(nextValue,locale):user?.role==="SELLER"?sellerOnboardingDestination({locale,intent:null,hasStore:Boolean(user.store),hasDraft:Boolean(user.sellerOnboardingDraft),onboardingStatus:user.store?.onboardingStatus,onboardingStep:user.store?.onboardingStep}):localizedHome(locale);
    const currentSession=await readSession();
    const destination=new URL(currentSession?.userId===result.userId?continuation:`${localizedHome(locale)}/login?next=${encodeURIComponent(continuation)}`,publicAppUrl());
    return NextResponse.redirect(destination,303);
  }
  const destination = new URL(`${localizedHome(locale)}/verify-email`, publicAppUrl());
  destination.searchParams.set("status", result.status);
  if(nextValue)destination.searchParams.set("next",safeLoginDestination(nextValue,locale));
  return NextResponse.redirect(destination, 303);
}
