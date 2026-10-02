import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import CreateStoreForm from "@/app/seller/create-store/CreateStoreForm";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner } from "@/lib/seller-business-access";
import { sellerBusinessCommercialPlan } from "@/lib/seller-business";
import { sellerTeamCopy } from "@/i18n/seller-team";

export const dynamic = "force-dynamic";

export default async function NewSellerStorePage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/seller/stores/new`)}`);
  let principal;
  try { principal = await requireBusinessOwner(prisma, session.userId); }
  catch { redirect(`/${locale}/dashboard`); }
  const [business, plan] = await Promise.all([
    prisma.sellerBusiness.findUnique({ where: { id: principal.businessId }, select: { maxStores: true, _count: { select: { stores: true } } } }),
    sellerBusinessCommercialPlan(prisma, principal.businessId),
  ]);
  if (!business || business._count.stores >= business.maxStores || plan !== "pro") redirect(`/${locale}/dashboard`);
  const copy=sellerTeamCopy(locale);
  return <main className="storeSetupPage"><section className="storeSetupCard"><a className="authBack" href={`/${locale}/dashboard`}>← {copy.dashboard}</a><h1>{copy.createStore}</h1><p className="storeSetupIntro">{copy.createStoreHelp}</p><CreateStoreForm locale={locale} sellerIntent={null}/></section></main>;
}
