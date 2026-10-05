import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerStoreChoices } from "@/lib/seller-business-access";
import { listSellerBenefits, SellerBenefitError } from "@/lib/seller-benefits";
import BenefitsCatalog from "./BenefitsCatalog";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SellerBenefitsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const [locale, session, params, dashboardText] = await Promise.all([getLocale(), readSession(), searchParams, getTranslations("DashboardPremium")]);
  if (!session) redirect(`/${locale}/login`);
  let data: Awaited<ReturnType<typeof listSellerBenefits>>;
  try {
    const stores = await sellerStoreChoices(prisma, session.userId);
    const storeId = params.store || stores[0]?.id;
    if (!storeId) notFound();
    data = await listSellerBenefits(prisma, session.userId, storeId);
  } catch (error) {
    if (!(error instanceof SellerBenefitError)) console.error("Seller benefits page failed", error);
    notFound();
  }
  return <main className="storeSetupPage"><section className="storeSetupCard">
    <a href={`/${locale}/dashboard`}>Todijo</a>
    <h1>Cadeaux et avantages Todijo</h1>
    <BenefitsCatalog locale={locale} store={data.store} storeLabel={dashboardText("nav.store")} stores={(await sellerStoreChoices(prisma, session.userId)).filter(store => store.businessId === data.businessId)} items={data.items.map(item => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), availableFrom: item.availableFrom?.toISOString() ?? null, availableUntil: item.availableUntil?.toISOString() ?? null }))} />
  </section></main>;
}
