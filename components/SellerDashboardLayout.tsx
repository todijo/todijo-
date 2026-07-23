import type { ReactNode } from "react";
import { BarChart3, Boxes, CircleDollarSign, Home, MessageCircle, ReceiptText, Settings, Star, Store } from "lucide-react";
import { DashboardHeader, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";

type Labels = {
  dashboard: string; products: string; orders: string; messages: string; statistics: string;
  revenue: string; reviews: string; store: string; settings: string; notifications: string;
  eyebrow: string; logout: string; menu: string; collapse: string;
};

export default function SellerDashboardLayout({ children, locale, storeSlug, firstName, lastName, labels, active, unreadMessages = 0 }: { children: ReactNode; locale: string; storeSlug: string; firstName: string; lastName: string; labels: Labels; active: "products" | "settings"; unreadMessages?: number }) {
  const items: DashboardNavItem[] = [
    { label: labels.dashboard, href: `/${locale}/dashboard`, icon: Home },
    { label: labels.products, href: `/${locale}/seller/products`, icon: Boxes, active: active === "products" },
    { label: labels.orders, href: `/${locale}/dashboard#recent-orders`, icon: ReceiptText },
    { label: labels.messages, href: `/${locale}/messages`, icon: MessageCircle, badge: unreadMessages },
    { label: labels.statistics, href: `/${locale}/dashboard#analytics`, icon: BarChart3 },
    { label: labels.revenue, href: `/${locale}/dashboard#analytics`, icon: CircleDollarSign },
    { label: labels.reviews, href: `/${locale}/store/${storeSlug}#reviews`, icon: Star },
    { label: labels.store, href: `/${locale}/store/${storeSlug}`, icon: Store },
    { label: labels.settings, href: `/${locale}/seller/store-settings`, icon: Settings, active: active === "settings" },
  ];
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={items} homeHref={`/${locale}`} logoutLabel={labels.logout} menuLabel={labels.menu} collapseLabel={labels.collapse} seller/>
    <div className="premiumDashboardMain">
      <DashboardHeader firstName={firstName} lastName={lastName} eyebrow={labels.eyebrow} notificationLabel={labels.notifications}/>
      <div className="premiumDashboardContent sellerControlContent">{children}</div>
    </div>
  </main>;
}
