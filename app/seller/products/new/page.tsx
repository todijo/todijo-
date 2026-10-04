import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import NewProductForm from "./NewProductForm";
import { requireStorePublishingAccess, sellerProductQuota, SellerSubscriptionError } from "@/lib/seller-subscription";
import { isLocale } from "@/i18n/config";
import { sellerEntitlementSubscriptionMessages } from "@/i18n/seller-entitlement-subscription";
import { resolveSellerStoreContext } from "@/lib/seller-business-access";
import { sellerBusinessCommercialPlan } from "@/lib/seller-business";

export const dynamic = "force-dynamic";

export default async function NewProductPage({searchParams}:{searchParams:Promise<{store?:string}>}) {
  const t = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale();
  const entitlementCopy=sellerEntitlementSubscriptionMessages[isLocale(locale)?locale:"en"];
  const countryNames=new Intl.DisplayNames([locale],{type:"region"});
  const session = await readSession();
  if (!session) redirect("/login");

  let storeContext;try{storeContext=await resolveSellerStoreContext(prisma,session.userId,(await searchParams).store??null,"PRODUCT_CREATE");await requireStorePublishingAccess(prisma,session.userId,storeContext.selected.id,"PRODUCT_CREATE")}catch(error){redirect(`/${locale}/seller/products${error instanceof SellerSubscriptionError && error.code === "SELLER_PRODUCT_LIMIT_REACHED" ? "?quota=limit" : ""}`)}
  const store = await prisma.store.findUnique({
    where: { id:storeContext.selected.id },
    select: {
      name: true, slug: true, currency: true, status: true, sellerType: true, vatStatus: true, shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingMinDays:true,shippingMaxDays:true,shippingWorldwide:true,shippingCountries:true,
      owner: { select: { firstName: true, lastName: true, role: true } },
      subscription: { select: { status: true, plan: true } },
      accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
      _count: { select: { products: true } },
    },
  });
  if (!store) redirect("/seller/create-store");
  if (store.sellerType === "UNKNOWN") redirect("/seller/store-settings");
  if (store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN") redirect("/seller/store-settings");
  const businessPlan=storeContext.selected.businessId?await sellerBusinessCommercialPlan(prisma,storeContext.selected.businessId):null;
  const quota = sellerProductQuota({ role: businessPlan==="admin-exempt"?"ADMIN":store.owner.role, plan: businessPlan, productCount: store._count.products });
  const productLimit = quota.productLimit;
  const labels = {
    dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"),
    statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"),
    settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"),
    menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct"),
  };

  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="new-product" canAddProduct>
    <SellerPageHeader
      eyebrow={t("sellerWorkspace")}
      title={t("addProductTitle")}
      description={t("addProductDescription")}
      backHref={`/${locale}/seller/products`}
      backLabel={p("nav.products")}
      badges={<>
        <SellerStatusBadge tone="accent">{store.name}</SellerStatusBadge>
        <SellerStatusBadge>{t("currencyBadge", { currency: store.currency })}</SellerStatusBadge>
        <SellerStatusBadge tone={productLimit && store._count.products >= productLimit ? "warning" : "success"}>
          {store.owner.role === "ADMIN" ? entitlementCopy.adminUnlimitedUsage(store._count.products) : productLimit ? t("planUsage", { count: store._count.products, limit: productLimit }) : t("unlimitedPlan")}
        </SellerStatusBadge>
      </>}
    />
    <NewProductForm storeId={storeContext.selected.id} currency={store.currency} productCount={store._count.products} productLimit={productLimit} storeShippingSummary={store.shippingEnabled?`${store.shippingMethodName??""} · ${store.shippingWorldwide?"Worldwide":store.shippingCountries.map(code=>countryNames.of(code)??code).join(", ")} · ${store.shippingFree?"Free":store.shippingPrice?.toString()??""} · ${store.shippingMinDays??"?"}–${store.shippingMaxDays??"?"} days`:undefined}/>
  </SellerDashboardLayout>;
}
