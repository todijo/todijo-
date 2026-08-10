import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BellRing, CreditCard, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerSection, SellerStatusBadge } from "@/components/SellerControlPanel";
import StoreSettingsForm from "./StoreSettingsForm";
import { canPublish } from "@/lib/seller-subscription";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const t = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const shippingText = await getTranslations("Shipping");
  const locale = await getLocale();

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, status: true, sellerType: true,
      legalBusinessName: true, businessRegistrationId: true, businessAddress: true, businessPostalCode: true, vatNumber: true, vatStatus: true,
      contactEmail: true, phone: true, currency: true, language: true,
      shippingEnabled: true, shippingMethodName: true, shippingPrice: true, shippingFree: true, shippingMinDays: true, shippingMaxDays: true, shippingCountries: true, shippingCarrier: true,
      owner: { select: { firstName: true, lastName: true } },
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
    },
  });
  if (!store) redirect("/seller/create-store");

  const labels = {
    dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"),
    statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"),
    settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"),
    menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct"),
  };

  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="settings" canAddProduct={canPublish(store)}>
    <SellerPageHeader
      eyebrow={t("sellerWorkspace")}
      title={t("settingsTitle")}
      description={t("settingsDescription")}
      backHref={`/${locale}/dashboard`}
      backLabel={t("backDashboard")}
      actions={<Link className="sellerControlButton light" href={`/${locale}/store/${store.slug}`}>{t("viewStore")}</Link>}
      badges={<><SellerStatusBadge tone="accent">{store.name}</SellerStatusBadge><SellerStatusBadge tone={["ACTIVE", "TRIALING"].includes(store.subscription?.status ?? "") ? "success" : "warning"}>{t("subscriptionStatus", { status: store.subscription?.status ?? "NOT_STARTED" })}</SellerStatusBadge></>}
    />

    <nav className="sellerSettingsTabs" aria-label={t("settingsTitle")}>
      <a href="#profile">{t("storeProfile")}</a><a href="#shipping">{shippingText("settingsTitle")}</a><a href="#media">{t("media")}</a><a href="#location">{t("address")}</a><a href="#billing">{t("billing")}</a><a href="#security">{t("security")}</a>
    </nav>

    <StoreSettingsForm initialValues={{
      name: store.name, description: store.description ?? "", contactEmail: store.contactEmail, phone: store.phone ?? "",
      logo: store.logo ?? "", banner: store.banner ?? "", country: store.country, city: store.city,
      currency: store.currency, language: store.language,
      sellerType: store.sellerType, legalBusinessName: store.legalBusinessName ?? "", businessRegistrationId: store.businessRegistrationId ?? "",
      businessAddress: store.businessAddress ?? "", businessPostalCode: store.businessPostalCode ?? "", vatNumber: store.vatNumber ?? "", vatStatus: store.vatStatus,
      shippingEnabled: store.shippingEnabled, shippingMethodName: store.shippingMethodName ?? "", shippingPrice: store.shippingPrice?.toString() ?? "", shippingFree: store.shippingFree, shippingMinDays: store.shippingMinDays, shippingMaxDays: store.shippingMaxDays, shippingCountries: store.shippingCountries, shippingCarrier: store.shippingCarrier ?? "",
    }} />

    <div className="sellerSettingsSupportGrid">
      <SellerSection id="notifications" icon={BellRing} title={t("notifications")} description={t("notificationsHelp")}><p className="sellerSettingsInfo"><BellRing size={18}/>{t("notificationsStatus")}</p></SellerSection>
      <SellerSection id="billing" icon={CreditCard} title={t("billing")} description={t("billingHelp")}>
        <div className="sellerBillingCard"><div><span>{t("currentPlan")}</span><strong>{store.subscription?.plan?.toUpperCase() ?? "—"}</strong><small>{t("subscriptionStatus", { status: store.subscription?.status ?? "NOT_STARTED" })}</small></div><Link href={`/${locale}/seller/subscription`}>{t("managePlan")}</Link></div>
      </SellerSection>
      <SellerSection id="security" icon={ShieldCheck} title={t("security")} description={t("securityHelp")}><p className="sellerSettingsInfo"><ShieldCheck size={18}/>{t("securityStatus")}</p></SellerSection>
    </div>
  </SellerDashboardLayout>;
}
