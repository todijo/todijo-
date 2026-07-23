import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BellRing, CreditCard, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerSection, SellerStatusBadge } from "@/components/SellerControlPanel";
import StoreSettingsForm from "./StoreSettingsForm";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const t = await getTranslations("SellerControl");
  const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common");
  const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale();

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true,
      contactEmail: true, phone: true, currency: true, language: true,
      owner: { select: { firstName: true, lastName: true } },
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  });
  if (!store) redirect("/seller/create-store");

  const labels = {
    dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"),
    statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"),
    settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"),
    menu: dashboardText("menu"), collapse: dashboardText("collapse"),
  };

  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={store.owner.firstName} lastName={store.owner.lastName} labels={labels} active="settings">
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
      <a href="#profile">{t("storeProfile")}</a><a href="#media">{t("media")}</a><a href="#location">{t("address")}</a><a href="#billing">{t("billing")}</a><a href="#security">{t("security")}</a>
    </nav>

    <StoreSettingsForm initialValues={{
      name: store.name, description: store.description ?? "", contactEmail: store.contactEmail, phone: store.phone ?? "",
      logo: store.logo ?? "", banner: store.banner ?? "", country: store.country, city: store.city,
      currency: store.currency, language: store.language,
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
