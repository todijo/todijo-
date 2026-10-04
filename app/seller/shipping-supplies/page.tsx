import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { requireProShippingSupplies } from "@/lib/pro-shipping-supplies";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import SuppliesRequestForm from "./SuppliesRequestForm";
export default async function ShippingSuppliesPage() {
  const locale = await getLocale(), session = await readSession();
  if (!session) redirect(`/${locale}/login`);
  try { await requireProShippingSupplies(prisma, session.userId); } catch { redirect(`/${locale}/seller/subscription`); }
  const copy = sellerFreeModelCopy(locale);
  return <main className="storeSetupPage"><section className="storeSetupCard"><a href={`/${locale}/dashboard`}>Todijo</a><h1>{copy.supplies}</h1><p>{copy.suppliesHelp}</p><SuppliesRequestForm locale={locale}/></section></main>;
}
