import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPlans } from "@/lib/seller-plans";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import NewProductForm from "./NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const t = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale();
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true, slug: true, currency: true, status: true,
      owner: { select: { firstName: true, lastName: true } },
      subscription: { select: { status: true, plan: true } },
      _count: { select: { products: true } },
    },
  });
  if (!store) redirect("/seller/create-store");
  if (store.status !== "ACTIVE" || !["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "")) redirect("/seller/subscription");

  const plan = sellerPlans().find((item) => item.id === store.subscription?.plan);
  const productLimit = plan?.productLimit ?? null;
  const labels = {
    dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"),
    statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"),
    settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"),
    menu: dashboardText("menu"), collapse: dashboardText("collapse"),
  };

  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="products">
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
    <NewProductForm currency={store.currency} productCount={store._count.products} productLimit={productLimit} />
  </SellerDashboardLayout>;
}
