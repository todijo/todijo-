import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";
import SellerExternalProductImport from "@/components/SellerExternalProductImport";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { sellerImportFieldCopy, sellerImportUiCopy } from "@/i18n/seller-import-copy";
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
  const importUi = sellerImportUiCopy(locale), fieldCopy = sellerImportFieldCopy(locale);
  const labels = { title: importUi.title, source: importUi.source, file: importUi.file, formats: importUi.formats, verify: importUi.verify, importDrafts: importUi.importDrafts, ready: importUi.ready, back: importUi.back, productName: fieldCopy.productName, description: fieldCopy.description, price: fieldCopy.price, category: fieldCopy.category, stock: fieldCopy.stock, sku: fieldCopy.sku, images: importUi.images, variants: importUi.variants, preview: importUi.verify, advancedMappings: importUi.advancedMappings, categoryPicker: { searchCategories: importUi.searchCategories, mainCategory: importUi.mainCategory, chooseMainCategory: importUi.chooseMainCategory, subcategory: importUi.subcategory, chooseSubcategory: importUi.chooseSubcategory, noSubcategory: importUi.noSubcategory, categoryPath: importUi.categoryPath, other: importUi.other }, importWorkflow: copy.importWorkflow };
  const fieldLabels = { ...fieldCopy, ...copy.importWorkflow, images: labels.images, variants: labels.variants, video: importUi.video, weightGrams: importUi.weightGrams, lengthMm: importUi.lengthMm, widthMm: importUi.widthMm, heightMm: importUi.heightMm };
  return <SellerDashboardLayout locale={locale} storeSlug={selectedStore.slug} firstName={user.firstName} lastName={user.lastName} active="import-products">
    <SellerStoreSwitcher stores={stores.stores} selectedId={stores.selected.id} allStoresLabel={marketplace("all")} storeLabel={control("store")}/>
    <SellerExternalProductImport storeId={stores.selected.id} storeName={stores.selected.name} storeCurrency={selectedStore.currency} backHref={`/${locale}/seller/products`} labels={labels} fieldLabels={fieldLabels} locale={locale}/>
  </SellerDashboardLayout>;
}
