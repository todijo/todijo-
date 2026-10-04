import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireProProductImport } from "@/lib/pro-product-import";

export const dynamic = "force-dynamic";

export default async function SellerProductImportPage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/seller/products/import`)}`);
  try { await requireProProductImport(prisma, session.userId); }
  catch { redirect(`/${locale}/seller/subscription?feature=product-import`); }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { firstName: true, lastName: true, store: { select: { slug: true } } } });
  const copy = sellerFreeModelCopy(locale);
  return <SellerDashboardLayout locale={locale} storeSlug={user.store?.slug ?? undefined} firstName={user.firstName} lastName={user.lastName} active="import-products">
    <section className="storeSetupCard" aria-labelledby="seller-import-title"><span className="dashboardBadge">PRO</span><h1 id="seller-import-title">{copy.importTitle}</h1><p>{copy.importIntro}</p><p>{copy.importUnavailable}</p><Link className="premiumTextLink" href={`/${locale}/seller/products`}>{copy.importBack}</Link></section>
  </SellerDashboardLayout>;
}
