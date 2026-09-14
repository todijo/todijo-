import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Boxes, CreditCard, Eye, Package, Plus, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import { canPublish } from "@/lib/seller-subscription";
import { listSellerProducts, parseSellerProductsQuery } from "@/lib/seller-products-pagination";
import SellerProductsList from "./SellerProductsList";

export const dynamic = "force-dynamic";
type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function SellerProductsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [t, control, p, common, dashboardText, transparency, compliance, supplierText, market, locale, session, params] = await Promise.all([getTranslations("Seller"), getTranslations("SellerControl"), getTranslations("DashboardPremium"), getTranslations("Common"), getTranslations("SellerDashboard"), getTranslations("SellerTransparency"), getTranslations("Compliance"), getTranslations("Supplier"), getTranslations("Marketplace"), getLocale(), readSession(), searchParams]);
  if (!session) redirect("/login");
  const store = await prisma.store.findUnique({ where: { ownerId: session.userId }, select: { id: true, name: true, slug: true, currency: true, status: true, sellerType: true, vatStatus: true, dropshippingEnabled: true, owner: { select: { firstName: true, lastName: true } }, subscription: { select: { status: true } }, accessGrants: { select: { source: true, startsAt: true, endsAt: true } } } });
  if (!store) redirect("/seller/create-store");
  const query = parseSellerProductsQuery(new URLSearchParams({ page: one(params?.page), q: one(params?.q), status: one(params?.status), sort: one(params?.sort) }));
  const result = await listSellerProducts(prisma, store.id, query);
  const subscriptionActive = canPublish(store), sellerTypeRequired = store.sellerType === "UNKNOWN", vatStatusRequired = store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN";
  const readinessHref = sellerTypeRequired || vatStatusRequired ? `/${locale}/seller/store-settings#seller-status` : `/${locale}/seller/subscription`;
  const readinessTitle = sellerTypeRequired ? transparency("statusPending") : vatStatusRequired ? compliance("vatStatus") : control("subscriptionInactive");
  const readinessHelp = sellerTypeRequired ? transparency("typeHelp") : vatStatusRequired ? compliance("vatNoExternalValidation") : control("subscriptionInactiveHelp", { status: control("subscriptionInactive") });
  const readinessAction = sellerTypeRequired ? transparency("typeTitle") : vatStatusRequired ? compliance("vatStatus") : control("viewPlans");
  const labels = { dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"), statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"), settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"), menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct") };
  const listKey = `${query.q}|${query.status}|${query.sort}|${result.page}`;
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="products" canAddProduct={subscriptionActive}>
    <SellerPageHeader eyebrow={control("sellerWorkspace")} title={t("myProducts")} description={t("manageIntro")} backHref={`/${locale}/dashboard`} backLabel={p("nav.dashboard")} badges={<><SellerStatusBadge tone="accent">{store.name}</SellerStatusBadge><SellerStatusBadge>{control("currencyBadge", { currency: store.currency })}</SellerStatusBadge></>} actions={subscriptionActive ? <Link className="sellerControlButton light" href={`/${locale}/seller/products/new`}><Plus size={17}/>{t("addProduct")}</Link> : undefined}/>
    {!subscriptionActive && <section className="subscriptionWarning sellerProductsWarning" role="status"><div><strong>{readinessTitle}</strong><span>{readinessHelp}</span></div><Link href={readinessHref}>{readinessAction}</Link></section>}
    {params?.removed === "1" && <p className="sellerControlFeedback" role="status">{control("productRemovedSuccess")}</p>}
    {store.dropshippingEnabled && <section className="sellerControlSection"><div className="sellerControlSectionHeading"><div><h2>{supplierText("accessTitle")}</h2><p>{supplierText("approvedNotConnected")}</p></div></div><p className="sellerControlFeedback" role="status">{supplierText("connectPending")}</p></section>}
    <section className="sellerProductSummary" aria-label={control("productSummary")}><article><Boxes size={20}/><span>{control("totalProducts")}</span><strong>{result.allTotal}</strong></article><article><Eye size={20}/><span>{control("publishedProducts")}</span><strong>{result.published}</strong></article><article><Package size={20}/><span>{control("draftProducts")}</span><strong>{result.allTotal - result.published}</strong></article><article><Warehouse size={20}/><span>{control("lowStock")}</span><strong>{result.lowStock}</strong></article></section>
    <form className="sellerProductsFilters" action={`/${locale}/seller/products`}><label>{common("search")}<input name="q" defaultValue={query.q} maxLength={100}/></label><label>{market("filters")}<select name="status" defaultValue={query.status}><option value="all">{market("all")}</option><option value="PUBLISHED">{control("published")}</option><option value="DRAFT">{control("draftStatus")}</option></select></label><label>{market("sort")}<select name="sort" defaultValue={query.sort}><option value="newest">{market("newest")}</option><option value="oldest">{market("oldest")}</option><option value="name">{t("productName")}</option></select></label><button className="sellerControlButton primary" type="submit">{market("apply")}</button></form>
    {result.allTotal === 0 ? <section className="emptyProductsPanel sellerProductsEmpty"><Package size={48} aria-hidden="true"/><h2>{t("noProducts")}</h2><p>{t("noProductsText")}</p><Link className="sellerControlButton primary" href={subscriptionActive ? `/${locale}/seller/products/new` : readinessHref}>{subscriptionActive ? <Plus size={17} aria-hidden="true"/> : sellerTypeRequired || vatStatusRequired ? <Boxes size={17} aria-hidden="true"/> : <CreditCard size={17} aria-hidden="true"/>}{subscriptionActive ? t("firstProduct") : readinessAction}</Link></section> : <SellerProductsList key={listKey} initialProducts={result.products} total={result.total} page={result.page} pages={result.pages} locale={locale} query={query}/>}
  </SellerDashboardLayout>;
}
