import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { BarChart3, Bell, Boxes, CircleDollarSign, CreditCard, FileClock, Gift, Home, MessageCircle, Plus, ReceiptText, Settings, ShieldCheck, Star, Store, UserRound, Users } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { loyaltyMessages } from "@/i18n/loyalty";
import { sellerEntitlementSubscriptionMessages } from "@/i18n/seller-entitlement-subscription";
import { DashboardHeader, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import EmailVerificationNotice from "./EmailVerificationNotice";
import { sellerTeamCopy } from "@/i18n/seller-team";
import { sellerPrincipals } from "@/lib/seller-business-access";
import type { TeamPermission } from "@prisma/client";

type Labels = {
  dashboard: string; products: string; orders: string; messages: string; statistics: string;
  revenue: string; reviews: string; store: string; settings: string; notifications: string;
  eyebrow: string; logout: string; menu: string; collapse: string; addProduct: string;
};

export type SellerNavigationActive = "dashboard" | "products" | "new-product" | "orders" | "messages" | "notifications" | "settings" | "subscription" | "loyalty" | "reviews" | "account";

export function sellerDashboardNavItems({ locale, storeSlug, publicStoreAvailable=true, labels, accountLabel, privacyLabel, active, unreadMessages = 0,ownerTools=false,permissions }: { locale: string; storeSlug?: string; publicStoreAvailable?: boolean; labels: Labels; accountLabel: string; privacyLabel: string; active: SellerNavigationActive; unreadMessages?: number;ownerTools?:boolean;permissions?:TeamPermission[] }): DashboardNavItem[] {
  const team=sellerTeamCopy(locale);
  const unrestricted=permissions===undefined;
  const can=(permission:TeamPermission)=>ownerTools||unrestricted||permissions.includes(permission);
  return [
    { label: labels.dashboard, href: `/${locale}/dashboard`, icon: Home, active: active === "dashboard" },
    ...(can("PRODUCT_VIEW")?[{ label: labels.products, href: `/${locale}/seller/products`, icon: Boxes, active: active === "products" }]:[]),
    ...(can("PRODUCT_CREATE")?[{ label: labels.addProduct, href: `/${locale}/seller/products/new`, icon: Plus, active: active === "new-product" }]:[]),
    ...(can("ORDER_VIEW")?[{ label: labels.orders, href: `/${locale}/seller/orders`, icon: ReceiptText, active: active === "orders" }]:[]),
    ...(can("MESSAGE_VIEW")?[{ label: labels.messages, href: `/${locale}/messages`, icon: MessageCircle, badge: unreadMessages, active: active === "messages" }]:[]),
    { label: labels.notifications, href: `/${locale}/notifications`, icon: Bell, active: active === "notifications" },
    ...(can("ANALYTICS_VIEW")?[{ label: labels.statistics, href: `/${locale}/dashboard#analytics`, icon: BarChart3 }]:[]),
    ...(can("SALES_VIEW")?[{ label: labels.revenue, href: `/${locale}/dashboard#analytics`, icon: CircleDollarSign }]:[]),
    ...(ownerTools?[{ label: labels.reviews, href: `/${locale}/seller/reviews`, icon: Star, active: active === "reviews" }]:[]),
    { label: labels.store, href: storeSlug ? publicStoreAvailable ? `/${locale}/store/${storeSlug}` : `/${locale}/seller/store-settings` : `/${locale}/sell#plans`, icon: Store },
    ...(can("STORE_VIEW_SETTINGS")?[{ label: labels.settings, href: `/${locale}/seller/store-settings`, icon: Settings, active: active === "settings" }]:[]),
    ...(ownerTools?[{ label: sellerEntitlementSubscriptionMessages[isLocale(locale) ? locale : "en"].title, href: `/${locale}/seller/subscription`, icon: CreditCard, active: active === "subscription" },
    { label: loyaltyMessages[isLocale(locale) ? locale : "fr"].title, href: `/${locale}/seller/loyalty`, icon: Gift, active: active === "loyalty" }]:[]),
    ...(ownerTools?[{label:team.title,href:`/${locale}/seller/team`,icon:Users},{label:team.audit,href:`/${locale}/seller/audit`,icon:FileClock}]:[]),
    { label: accountLabel, href: `/${locale}/account`, icon: UserRound, active: active === "account" },
    { label: privacyLabel, href: `/${locale}/info/privacy-data`, icon: ShieldCheck },
  ];
}

export default async function SellerDashboardLayout({ children, locale, storeSlug, firstName, lastName, labels, active, canAddProduct, unreadMessages = 0 }: { children: ReactNode; locale: string; storeSlug?: string; firstName: string; lastName: string; labels?: Labels; active: SellerNavigationActive; canAddProduct?: boolean; unreadMessages?: number }) {
  const [p,s,common,privacy]=await Promise.all([getTranslations("DashboardPremium"),getTranslations("SellerDashboard"),getTranslations("Common"),getTranslations("Privacy")]);
  const text=labels??{dashboard:p("nav.dashboard"),products:p("nav.products"),orders:p("nav.orders"),messages:p("nav.messages"),statistics:p("nav.statistics"),revenue:p("nav.revenue"),reviews:p("nav.reviews"),store:p("nav.store"),settings:p("nav.settings"),notifications:p("notifications"),eyebrow:p("seller.eyebrow"),logout:common("logout"),menu:s("menu"),collapse:s("collapse"),addProduct:p("nav.addProduct")};
  const session=await readSession();
  const principals=session?await sellerPrincipals(prisma,session.userId):[];
  const ownerTools=principals.some(principal=>principal.owner);
  const permissions=ownerTools?undefined:[...new Set(principals.flatMap(principal=>principal.permissions))];
  const items = sellerDashboardNavItems({ locale, storeSlug, publicStoreAvailable:canAddProduct!==false, labels: text, accountLabel: common("account"), privacyLabel: privacy("privacyData"), active, unreadMessages,ownerTools,permissions });
  const mobileMenuItems = items;
  const verification=session?await prisma.user.findUnique({where:{id:session.userId},select:{email:true,emailVerified:true}}):null;
  return <main className="premiumDashboard premiumSellerDashboard">
    <DashboardSidebar items={items} mobileMenuItems={mobileMenuItems} homeHref={`/${locale}`} logoutLabel={text.logout} menuLabel={text.menu} collapseLabel={text.collapse} seller/>
    <div className="premiumDashboardMain">
      <DashboardHeader firstName={firstName} lastName={lastName} eyebrow={text.eyebrow} homeHref={`/${locale}`} notificationHref={`/${locale}/notifications`} notificationLabel={text.notifications} notificationCount={unreadMessages}/>
      <div className="premiumDashboardContent sellerControlContent">{verification&&!verification.emailVerified&&<EmailVerificationNotice email={verification.email} locale={isLocale(locale)?locale:"en"}/>} {children}</div>
    </div>
  </main>;
}
