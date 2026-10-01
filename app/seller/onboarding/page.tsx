import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { defaultBuyerAddress } from "@/lib/buyer-addresses";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import SellerOnboardingForm from "./SellerAddressOnboardingForm";

export const dynamic = "force-dynamic";

export default async function SellerOnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, query, session] = await Promise.all([getLocale(), searchParams, readSession()]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  if (!session) {
    if (!intent) redirect(`/${locale}/sell#plans`);
    redirect(`/${locale}/login?next=${encodeURIComponent(sellerOnboardingPath(locale, false, intent))}`);
  }
  if(session.role==="ADMIN") redirect(`/${locale}/dashboard`);
  const [user, buyerAddress] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { sellerOnboardingDraft:true, store: { select: { name: true, country: true, city: true, phone: true, businessAddress: true, businessPostalCode: true, sellerType: true, sellerLegalForm: true, businessRegistrationId: true, legalBusinessName: true, vatStatus: true, vatNumber: true } } } }),
    defaultBuyerAddress(prisma, session.userId),
  ]);
  if (!user) redirect(`/${locale}/login`);
  if (intent) redirect(sellerOnboardingPath(locale, Boolean(user.store), intent));
  if (!user.store && !user.sellerOnboardingDraft) redirect(`/${locale}/sell#plans`);
  const store = user.store, draft = user.sellerOnboardingDraft;
  return <SellerOnboardingForm buyerAddress={buyerAddress ? { address: [buyerAddress.addressLine1, buyerAddress.addressLine2].filter(Boolean).join(", "), postalCode: buyerAddress.postalCode, city: buyerAddress.city, country: buyerAddress.country, phone: buyerAddress.phone ?? "" } : null} initial={{ storeName: store?.name ?? draft?.storeName ?? "", country: store?.country ?? draft?.country ?? "", city: store?.city ?? draft?.city ?? "", phone: store?.phone ?? draft?.phone ?? "", address: store?.businessAddress ?? draft?.address ?? "", postalCode: store?.businessPostalCode ?? draft?.postalCode ?? "", sellerType: (store?.sellerType ?? draft?.sellerType) === "PROFESSIONAL" ? "PROFESSIONAL" : "PRIVATE", legalForm: store?.sellerLegalForm ?? draft?.legalForm ?? "", businessRegistrationNumber: store?.businessRegistrationId ?? draft?.businessRegistrationNumber ?? "", legalBusinessName: store?.legalBusinessName ?? draft?.legalBusinessName ?? "", vatStatus: store?.vatStatus ?? draft?.vatStatus ?? "UNKNOWN", vatNumber: store?.vatNumber ?? draft?.vatNumber ?? "" }} />;
}
