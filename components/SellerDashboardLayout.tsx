import type { ReactNode } from "react";
import { BarChart3, Boxes, CircleDollarSign, Home, MessageCircle, Plus, ReceiptText, Settings, Star, Store } from "lucide-react";
import { DashboardHeader, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";

type Labels = {
  dashboard: string; products: string; orders: string; messages: string; statistics: string;
  revenue: string; reviews: string; store: string; settings: string; notifications: string;
  eyebrow: string; logout: string; menu: string; collapse: string; addProduct: string;
};

export default function SellerDashboardLayout({ children, locale, storeSlug, firstName, lastName, labels, active, canAddProduct = false, unreadMessages = 0 }: { children: ReactNode; locale: string; storeSlug: string; firstName: string; lastName: string; labels: Labels; active: "products" | "new-product" | "settings"; canAddProduct?: boolean; unreadMessages?: number }) {
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
  const mobileMenuItems = canAddProduct
    ? [items[0], { label: labels.addProduct, href: `/${locale}/seller/products/new`, icon: Plus, active: active === "new-product" }, ...items.slice(1)]
    : items;
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={items} mobileMenuItems={mobileMenuItems} homeHref={`/${locale}`} logoutLabel={labels.logout} menuLabel={labels.menu} collapseLabel={labels.collapse} seller/>
    <div className="premiumDashboardMain">
      <DashboardHeader firstName={firstName} lastName={lastName} eyebrow={labels.eyebrow} homeHref={`/${locale}`} notificationLabel={labels.notifications}/>
      <div className="premiumDashboardContent sellerControlContent">{children}</div>
    </div>
  </main>;
}
