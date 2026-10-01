import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import SellerOnboardingForm from "./SellerOnboardingForm";

export const dynamic = "force-dynamic";

export default async function SellerOnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, query, session] = await Promise.all([getLocale(), searchParams, readSession()]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  if (!session) {
    if (!intent) redirect(`/${locale}/sell#plans`);
    redirect(`/${locale}/login?next=${encodeURIComponent(sellerOnboardingPath(locale, false, intent))}`);
  }
  if(session.role==="ADMIN") redirect(`/${locale}/dashboard`);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true, profileAddress: true, profilePostalCode: true, profileCity: true, profileCountry: true, sellerOnboardingDraft:true, store: { select: { name: true, country: true, city: true, phone: true, businessAddress: true, businessPostalCode: true, sellerType: true, sellerLegalForm: true, businessRegistrationId: true, legalBusinessName: true, vatStatus: true, vatNumber: true } } } });
  if (!user) redirect(`/${locale}/login`);
  if (intent) redirect(sellerOnboardingPath(locale, Boolean(user.store), intent));
  if (!user.store && !user.sellerOnboardingDraft) redirect(`/${locale}/sell#plans`);
  const store = user.store, draft = user.sellerOnboardingDraft;
  return <SellerOnboardingForm initial={{ storeName: store?.name ?? draft?.storeName ?? "", country: store?.country ?? draft?.country ?? user.profileCountry ?? "", city: store?.city ?? draft?.city ?? user.profileCity ?? "", phone: store?.phone ?? draft?.phone ?? user.phone ?? "", address: store?.businessAddress ?? draft?.address ?? user.profileAddress ?? "", postalCode: store?.businessPostalCode ?? draft?.postalCode ?? user.profilePostalCode ?? "", sellerType: (store?.sellerType ?? draft?.sellerType) === "PROFESSIONAL" ? "PROFESSIONAL" : "PRIVATE", legalForm: store?.sellerLegalForm ?? draft?.legalForm ?? "", businessRegistrationNumber: store?.businessRegistrationId ?? draft?.businessRegistrationNumber ?? "", legalBusinessName: store?.legalBusinessName ?? draft?.legalBusinessName ?? "", vatStatus: store?.vatStatus ?? draft?.vatStatus ?? "UNKNOWN", vatNumber: store?.vatNumber ?? draft?.vatNumber ?? "" }} />;
}
