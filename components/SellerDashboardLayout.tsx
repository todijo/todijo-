import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { BarChart3, Boxes, CircleDollarSign, Home, MessageCircle, Plus, ReceiptText, Settings, ShieldCheck, Star, Store, UserRound } from "lucide-react";
import { DashboardHeader, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";

type Labels = {
  dashboard: string; products: string; orders: string; messages: string; statistics: string;
  revenue: string; reviews: string; store: string; settings: string; notifications: string;
  eyebrow: string; logout: string; menu: string; collapse: string; addProduct: string;
};

export type SellerNavigationActive = "dashboard" | "products" | "new-product" | "orders" | "messages" | "settings" | "reviews" | "account";

export function sellerDashboardNavItems({ locale, storeSlug, labels, accountLabel, privacyLabel, active, unreadMessages = 0 }: { locale: string; storeSlug?: string; labels: Labels; accountLabel: string; privacyLabel: string; active: SellerNavigationActive; unreadMessages?: number }): DashboardNavItem[] {
  return [
    { label: labels.dashboard, href: `/${locale}/dashboard`, icon: Home, active: active === "dashboard" },
    { label: labels.products, href: `/${locale}/seller/products`, icon: Boxes, active: active === "products" },
    { label: labels.addProduct, href: `/${locale}/seller/products/new`, icon: Plus, active: active === "new-product" },
    { label: labels.orders, href: `/${locale}/seller/orders`, icon: ReceiptText, active: active === "orders" },
    { label: labels.messages, href: `/${locale}/messages`, icon: MessageCircle, badge: unreadMessages, active: active === "messages" },
    { label: labels.statistics, href: `/${locale}/dashboard#analytics`, icon: BarChart3 },
    { label: labels.revenue, href: `/${locale}/dashboard#analytics`, icon: CircleDollarSign },
    { label: labels.reviews, href: `/${locale}/seller/reviews`, icon: Star, active: active === "reviews" },
    { label: labels.store, href: storeSlug ? `/${locale}/store/${storeSlug}` : `/${locale}/seller/create-store`, icon: Store },
    { label: labels.settings, href: `/${locale}/seller/store-settings`, icon: Settings, active: active === "settings" },
    { label: accountLabel, href: `/${locale}/account`, icon: UserRound, active: active === "account" },
    { label: privacyLabel, href: `/${locale}/info/privacy-data`, icon: ShieldCheck },
  ];
}

export default async function SellerDashboardLayout({ children, locale, storeSlug, firstName, lastName, labels, active, unreadMessages = 0 }: { children: ReactNode; locale: string; storeSlug?: string; firstName: string; lastName: string; labels?: Labels; active: SellerNavigationActive; canAddProduct?: boolean; unreadMessages?: number }) {
  const [p,s,common,privacy]=await Promise.all([getTranslations("DashboardPremium"),getTranslations("SellerDashboard"),getTranslations("Common"),getTranslations("Privacy")]);
  const text=labels??{dashboard:p("nav.dashboard"),products:p("nav.products"),orders:p("nav.orders"),messages:p("nav.messages"),statistics:p("nav.statistics"),revenue:p("nav.revenue"),reviews:p("nav.reviews"),store:p("nav.store"),settings:p("nav.settings"),notifications:p("notifications"),eyebrow:p("seller.eyebrow"),logout:common("logout"),menu:s("menu"),collapse:s("collapse"),addProduct:p("nav.addProduct")};
  const items = sellerDashboardNavItems({ locale, storeSlug, labels: text, accountLabel: common("account"), privacyLabel: privacy("privacyData"), active, unreadMessages });
  const mobileMenuItems = items;
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={items} mobileMenuItems={mobileMenuItems} homeHref={`/${locale}`} logoutLabel={text.logout} menuLabel={text.menu} collapseLabel={text.collapse} seller/>
    <div className="premiumDashboardMain">
      <DashboardHeader firstName={firstName} lastName={lastName} eyebrow={text.eyebrow} homeHref={`/${locale}`} notificationHref={`/${locale}/notifications`} notificationLabel={text.notifications} notificationCount={unreadMessages}/>
      <div className="premiumDashboardContent sellerControlContent">{children}</div>
    </div>
  </main>;
}
