import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPlans } from "@/lib/seller-plans";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import NewProductForm from "./NewProductForm";
import { canPublish } from "@/lib/seller-subscription";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const t = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale();
  const countryNames=new Intl.DisplayNames([locale],{type:"region"});
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true, slug: true, currency: true, status: true, sellerType: true, vatStatus: true, shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingMinDays:true,shippingMaxDays:true,shippingWorldwide:true,shippingCountries:true,
      owner: { select: { firstName: true, lastName: true } },
      subscription: { select: { status: true, plan: true } },
      accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
      _count: { select: { products: true } },
    },
  });
  if (!store) redirect("/seller/create-store");
  if (store.sellerType === "UNKNOWN") redirect("/seller/store-settings");
  if (store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN") redirect("/seller/store-settings");
  if (!canPublish(store)) redirect("/seller/subscription");

  const plan = sellerPlans().find((item) => item.id === store.subscription?.plan);
  const productLimit = plan?.productLimit ?? null;
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
          {productLimit ? t("planUsage", { count: store._count.products, limit: productLimit }) : t("unlimitedPlan")}
        </SellerStatusBadge>
      </>}
    />
    <NewProductForm currency={store.currency} productCount={store._count.products} productLimit={productLimit} storeShippingSummary={store.shippingEnabled?`${store.shippingMethodName??""} · ${store.shippingWorldwide?"Worldwide":store.shippingCountries.map(code=>countryNames.of(code)??code).join(", ")} · ${store.shippingFree?"Free":store.shippingPrice?.toString()??""} · ${store.shippingMinDays??"?"}–${store.shippingMaxDays??"?"} days`:undefined}/>
  </SellerDashboardLayout>;
}
