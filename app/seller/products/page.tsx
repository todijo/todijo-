import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Boxes, CreditCard, Eye, Package, Plus, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import { canPublish, sellerProductQuota } from "@/lib/seller-subscription";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { listSellerProducts, parseSellerProductsQuery } from "@/lib/seller-products-pagination";
import SellerProductsList from "./SellerProductsList";
import { resolveSellerStoreContext } from "@/lib/seller-business-access";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";
import { sellerBusinessCommercialPlan } from "@/lib/seller-business";
import { hasVerifiedFrenchBusiness } from "@/lib/seller-business-verification-policy";
import { effectiveSellerPlan } from "@/lib/seller-subscription";
import { hasProSellerCapabilities } from "@/lib/seller-commercial-access";
import { dropshippingAccessMessages } from "@/i18n/dropshipping-access";
import { sellerProductCategoryScope } from "@/lib/seller-team-product-scope";

export const dynamic = "force-dynamic";
type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function SellerProductsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [t, control, p, common, dashboardText, transparency, compliance, verification, supplierText, market, locale, session, params] = await Promise.all([getTranslations("Seller"), getTranslations("SellerControl"), getTranslations("DashboardPremium"), getTranslations("Common"), getTranslations("SellerDashboard"), getTranslations("SellerTransparency"), getTranslations("Compliance"),getTranslations("SellerBusinessVerification"), getTranslations("Supplier"), getTranslations("Marketplace"), getLocale(), readSession(), searchParams]);
  if (!session) redirect("/login");
  let storeContext;try{storeContext=await resolveSellerStoreContext(prisma,session.userId,one(params?.store)||null,"PRODUCT_VIEW")}catch{redirect(`/${locale}/dashboard`)}
  const store = await prisma.store.findUnique({where:{id:storeContext.selected.id}, select: { id: true, name: true, slug: true, country:true,businessRegistrationId:true,currency: true, status: true, sellerType: true, vatStatus: true,business:{select:{siren:true,inseeVerificationState:true}},establishment:{select:{siret:true,legalUnitSiren:true,verificationState:true}}, dropshippingEnabled: true, owner: { select: { firstName: true, lastName: true, role: true } }, subscription: { select: { status: true, plan: true, currentPeriodEnd:true } }, accessGrants: { select: { source: true, plan:true, startsAt: true, endsAt: true } } } });
  if (!store) redirect("/seller/create-store");
  const query = parseSellerProductsQuery(new URLSearchParams({ page: one(params?.page), q: one(params?.q), status: one(params?.status), sort: one(params?.sort) }));
  const result = await listSellerProducts(prisma, store.id, query, await sellerProductCategoryScope(prisma,session.userId,store.id));
  const commercialPlan=storeContext.selected.businessId?await sellerBusinessCommercialPlan(prisma,storeContext.selected.businessId):effectiveSellerPlan({role:store.owner.role,subscription:store.subscription,accessGrants:store.accessGrants});
  const dropshippingPro=hasProSellerCapabilities(commercialPlan);
  const dropshippingCopy=dropshippingAccessMessages[locale]??dropshippingAccessMessages.en;
  const subscriptionActive = canPublish(store,new Date(),commercialPlan), sellerTypeRequired = store.sellerType === "UNKNOWN", vatStatusRequired = store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN";
  const storedProductCount = await prisma.product.count({ where: { storeId: store.id } });
  const quota = sellerProductQuota({ role: commercialPlan === "admin-exempt" ? "ADMIN" : "SELLER", plan: commercialPlan ?? "free", productCount: storedProductCount });
  const canAddProduct = subscriptionActive && !quota.blocked;
  const freeCopy = sellerFreeModelCopy(locale);
  const storeReadinessPending=store.status!=="ACTIVE";
  const businessVerificationRequired=!hasVerifiedFrenchBusiness(store);
  const readinessHref = businessVerificationRequired||sellerTypeRequired || vatStatusRequired || storeReadinessPending ? `/${locale}/seller/store-settings#location` : `/${locale}/seller/subscription`;
  const readinessTitle = businessVerificationRequired ? verification("sectionTitle") : sellerTypeRequired ? transparency("statusPending") : vatStatusRequired ? compliance("vatStatus") : store.status==="PENDING" ? freeCopy.storeReviewTitle : storeReadinessPending ? freeCopy.storeUnavailableTitle : freeCopy.readinessTitle;
  const readinessHelp = businessVerificationRequired ? verification("dashboardPending") : sellerTypeRequired ? transparency("typeHelp") : vatStatusRequired ? compliance("vatNoExternalValidation") : store.status==="PENDING" ? freeCopy.storeReviewHelp : storeReadinessPending ? freeCopy.storeUnavailableHelp : freeCopy.readinessHelp;
  const readinessAction = businessVerificationRequired ? verification("verify") : sellerTypeRequired ? transparency("typeTitle") : vatStatusRequired ? compliance("vatStatus") : commercialPlan==null ? freeCopy.compare : freeCopy.readinessAction;
  const labels = { dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"), statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"), settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"), menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct") };
  const listKey = `${query.q}|${query.status}|${query.sort}|${result.page}`;
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="products" canAddProduct={canAddProduct}>
    <SellerStoreSwitcher stores={storeContext.stores} selectedId={store.id} allStoresLabel="All stores" storeLabel={p("nav.store")}/>
    <SellerPageHeader eyebrow={control("sellerWorkspace")} title={t("myProducts")} description={t("manageIntro")} backHref={`/${locale}/dashboard`} backLabel={p("nav.dashboard")} badges={<><SellerStatusBadge tone="accent">{store.name}</SellerStatusBadge><SellerStatusBadge>{control("currencyBadge", { currency: store.currency })}</SellerStatusBadge></>} actions={canAddProduct ? <Link className="sellerControlButton light" href={`/${locale}/seller/products/new?store=${store.id}`}><Plus size={17}/>{t("addProduct")}</Link> : undefined}/>
    {subscriptionActive && quota.blocked && <section className="subscriptionWarning sellerProductsWarning" role="status"><div><strong>{quota.productLimit === 5 ? freeCopy.quota : control("planUsage", { count: storedProductCount, limit: quota.productLimit ?? 0 })}</strong></div><Link href={`/${locale}/seller/subscription`}>{freeCopy.compare}</Link></section>}
    {!subscriptionActive && <section className="subscriptionWarning sellerProductsWarning" role="status"><div><strong>{readinessTitle}</strong><span>{readinessHelp}</span></div><Link href={readinessHref}>{readinessAction}</Link></section>}
    {params?.removed === "1" && <p className="sellerControlFeedback" role="status">{control("productRemovedSuccess")}</p>}
    {dropshippingPro && <section className="sellerControlSection"><div className="sellerControlSectionHeading"><div><h2>{supplierText("accessTitle")}</h2><p>{store.dropshippingEnabled ? supplierText("approvedNotConnected") : dropshippingCopy.proApprovalBlocked ?? supplierText("permissionDisabled")}</p></div></div>{store.dropshippingEnabled && <p className="sellerControlFeedback" role="status">{supplierText("connectPending")}</p>}</section>}
    <section className="sellerProductSummary" aria-label={control("productSummary")}><article><Boxes size={20}/><span>{control("totalProducts")}</span><strong>{result.allTotal}</strong></article><article><Eye size={20}/><span>{control("publishedProducts")}</span><strong>{result.published}</strong></article><article><Package size={20}/><span>{control("draftProducts")}</span><strong>{result.allTotal - result.published}</strong></article><article><Warehouse size={20}/><span>{control("lowStock")}</span><strong>{result.lowStock}</strong></article></section>
    <form className="sellerProductsFilters" action={`/${locale}/seller/products`}><input type="hidden" name="store" value={store.id}/><label>{common("search")}<input name="q" defaultValue={query.q} maxLength={100}/></label><label>{market("filters")}<select name="status" defaultValue={query.status}><option value="all">{market("all")}</option><option value="PUBLISHED">{control("published")}</option><option value="DRAFT">{control("draftStatus")}</option></select></label><label>{market("sort")}<select name="sort" defaultValue={query.sort}><option value="newest">{market("newest")}</option><option value="oldest">{market("oldest")}</option><option value="name">{t("productName")}</option></select></label><button className="sellerControlButton primary" type="submit">{market("apply")}</button></form>
    {result.allTotal === 0 ? <section className="emptyProductsPanel sellerProductsEmpty"><Package size={48} aria-hidden="true"/><h2>{t("noProducts")}</h2><p>{t("noProductsText")}</p><Link className="sellerControlButton primary" href={canAddProduct ? `/${locale}/seller/products/new?store=${store.id}` : readinessHref}>{canAddProduct ? <Plus size={17} aria-hidden="true"/> : sellerTypeRequired || vatStatusRequired ? <Boxes size={17} aria-hidden="true"/> : <CreditCard size={17} aria-hidden="true"/>}{canAddProduct ? t("firstProduct") : readinessAction}</Link></section> : <SellerProductsList key={listKey} initialProducts={result.products} total={result.total} page={result.page} pages={result.pages} locale={locale} query={query} storeId={store.id}/>}
  </SellerDashboardLayout>;
}
