import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";
import SellerExternalProductImport from "@/components/SellerExternalProductImport";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireProProductImport } from "@/lib/pro-product-import";
import { resolveSellerStoreContext } from "@/lib/seller-business-access";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SellerProductImportPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const [locale, session, params, control, marketplace] = await Promise.all([getLocale(), readSession(), searchParams, getTranslations("SellerControl"), getTranslations("Marketplace")]);
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/seller/products/import`)}`);
  let principal; try { principal = await requireProProductImport(prisma, session.userId); }
  catch { redirect(`/${locale}/seller/subscription?feature=product-import`); }
  let stores; try { stores = await resolveSellerStoreContext(prisma, session.userId, params.store ?? null, "PRODUCT_CREATE"); }
  catch { redirect(`/${locale}/seller/products`); }
  if (stores.selected.businessId !== principal.businessId) redirect(`/${locale}/seller/products`);
  const [user, selectedStore] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { firstName: true, lastName: true } }), prisma.store.findUniqueOrThrow({ where: { id: stores.selected.id }, select: { slug: true, currency: true } })]);
  const copy = sellerFreeModelCopy(locale);
  const labels = { title: copy.importTitle, source: copy.importSource, file: copy.importFile, formats: copy.importFormats, verify: copy.importVerify, importDrafts: copy.importAsDrafts, ready: copy.importReady, back: copy.importBack, productName: control("productName"), description: control("description"), price: control("price", { currency: selectedStore.currency }), category: control("category"), stock: control("stock"), sku: "SKU", images: locale === "fr" ? "Image de l’article (URL)" : control("images"), variants: control("variants"), preview: copy.importVerify };
  const fieldLabels = { productName: labels.productName, description: labels.description, price: labels.price, category: labels.category, stock: labels.stock, sku: labels.sku, images: labels.images, variants: labels.variants };
  return <SellerDashboardLayout locale={locale} storeSlug={selectedStore.slug} firstName={user.firstName} lastName={user.lastName} active="import-products">
    <SellerStoreSwitcher stores={stores.stores} selectedId={stores.selected.id} allStoresLabel={marketplace("all")} storeLabel={control("store")}/>
    <SellerExternalProductImport storeId={stores.selected.id} storeName={stores.selected.name} backHref={`/${locale}/seller/products`} labels={labels} fieldLabels={fieldLabels} locale={locale}/>
  </SellerDashboardLayout>;
}
