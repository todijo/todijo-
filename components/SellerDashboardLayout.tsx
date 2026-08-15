import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { BarChart3, Boxes, CircleDollarSign, Home, MessageCircle, Plus, ReceiptText, Settings, ShieldCheck, Star, Store, UserRound } from "lucide-react";
import { DashboardHeader, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";

type Labels = {
  dashboard: string; products: string; orders: string; messages: string; statistics: string;
  revenue: string; reviews: string; store: string; settings: string; notifications: string;
  eyebrow: string; logout: string; menu: string; collapse: string; addProduct: string;
};

export default async function SellerDashboardLayout({ children, locale, storeSlug, firstName, lastName, labels, active, unreadMessages = 0 }: { children: ReactNode; locale: string; storeSlug?: string; firstName: string; lastName: string; labels?: Labels; active: "dashboard" | "products" | "new-product" | "orders" | "messages" | "settings" | "reviews" | "account"; canAddProduct?: boolean; unreadMessages?: number }) {
  const [p,s,common,privacy]=await Promise.all([getTranslations("DashboardPremium"),getTranslations("SellerDashboard"),getTranslations("Common"),getTranslations("Privacy")]);
  const text=labels??{dashboard:p("nav.dashboard"),products:p("nav.products"),orders:p("nav.orders"),messages:p("nav.messages"),statistics:p("nav.statistics"),revenue:p("nav.revenue"),reviews:p("nav.reviews"),store:p("nav.store"),settings:p("nav.settings"),notifications:p("notifications"),eyebrow:p("seller.eyebrow"),logout:common("logout"),menu:s("menu"),collapse:s("collapse"),addProduct:p("nav.addProduct")};
  const baseItems: DashboardNavItem[] = [
    { label: text.dashboard, href: `/${locale}/dashboard`, icon: Home, active: active === "dashboard" },
    { label: text.products, href: `/${locale}/seller/products`, icon: Boxes, active: active === "products" },
    { label: text.addProduct, href: `/${locale}/seller/products/new`, icon: Plus, active: active === "new-product" },
    { label: text.orders, href: `/${locale}/seller/orders`, icon: ReceiptText, active: active === "orders" },
    { label: text.messages, href: `/${locale}/messages`, icon: MessageCircle, badge: unreadMessages, active: active === "messages" },
    { label: text.statistics, href: `/${locale}/dashboard#analytics`, icon: BarChart3 },
    { label: text.revenue, href: `/${locale}/dashboard#analytics`, icon: CircleDollarSign },
    { label: text.reviews, href: `/${locale}/seller/reviews`, icon: Star, active: active === "reviews" },
    { label: text.store, href: storeSlug?`/${locale}/store/${storeSlug}`:`/${locale}/seller/create-store`, icon: Store },
    { label: text.settings, href: `/${locale}/seller/store-settings`, icon: Settings, active: active === "settings" },
    { label: common("account"), href: `/${locale}/account`, icon: UserRound, active: active === "account" },
    { label: privacy("privacyData"), href: `/${locale}/info/privacy-data`, icon: ShieldCheck },
  ];
  const items = baseItems;
  const mobileMenuItems = items;
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={items} mobileMenuItems={mobileMenuItems} homeHref={`/${locale}`} logoutLabel={text.logout} menuLabel={text.menu} collapseLabel={text.collapse} seller/>
    <div className="premiumDashboardMain">
      <DashboardHeader firstName={firstName} lastName={lastName} eyebrow={text.eyebrow} homeHref={`/${locale}`} notificationHref={`/${locale}/notifications`} notificationLabel={text.notifications} notificationCount={unreadMessages}/>
      <div className="premiumDashboardContent sellerControlContent">{children}</div>
    </div>
  </main>;
}
