import type { ReactNode } from "react";
import { Bell, Home, MessageCircle, ReceiptText, Settings, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { DashboardHeader, DashboardQuickAction, DashboardSidebar, type DashboardNavItem } from "./DashboardUI";
import EmailVerificationNotice from "./EmailVerificationNotice";

export type BuyerNavigationActive = "dashboard"|"orders"|"messages"|"notifications"|"account"|"cart";

export default async function BuyerDashboardLayout({children,locale,active}:{children:ReactNode;locale:string;active:BuyerNavigationActive}) {
  const session=await readSession(); if(!session)redirect(`/${locale}/login`);
  const [user,p,s,common,privacy]=await Promise.all([
    prisma.user.findUnique({where:{id:session.userId},select:{role:true,firstName:true,lastName:true,email:true,emailVerified:true,_count:{select:{notifications:{where:{readAt:null}}}}}}),
    getTranslations("DashboardPremium"),getTranslations("SellerDashboard"),getTranslations("Common"),getTranslations("Privacy"),
  ]);
  if(!user)redirect(`/${locale}/login`); if(user.role!=="CUSTOMER")redirect(`/${locale}/dashboard`);
  const unreadMessages=await prisma.message.count({where:{readAt:null,senderId:{not:session.userId},conversation:{buyerId:session.userId}}});
  const items:DashboardNavItem[]=[
    {label:p("nav.dashboard"),href:`/${locale}/dashboard`,icon:Home,active:active==="dashboard"},
    {label:p("nav.orders"),href:`/${locale}/account/orders`,icon:ReceiptText,active:active==="orders"},
    {label:p("nav.messages"),href:`/${locale}/messages`,icon:MessageCircle,badge:unreadMessages,active:active==="messages"},
    {label:p("notifications"),href:`/${locale}/notifications`,icon:Bell,badge:user._count.notifications,active:active==="notifications"},
    {label:common("account"),href:`/${locale}/account`,icon:Settings,active:active==="account"},
    {label:common("cart"),href:`/${locale}/cart`,icon:ShoppingCart,active:active==="cart"},
    {label:privacy("privacyData"),href:`/${locale}/info/privacy-data`,icon:ShieldCheck},
  ];
  const safeLocale=isLocale(locale)?locale:"en";
  return <main className="premiumDashboard premiumBuyerDashboard"><DashboardSidebar items={items} homeHref={`/${locale}`} logoutLabel={common("logout")} menuLabel={s("menu")} collapseLabel={s("collapse")}/><div className="premiumDashboardMain"><DashboardHeader firstName={user.firstName} lastName={user.lastName} eyebrow={p("buyer.eyebrow")} homeHref={`/${locale}`} notificationHref={`/${locale}/notifications`} notificationLabel={p("notifications")} notificationCount={user._count.notifications}/><div className="premiumDashboardContent">{!user.emailVerified&&<EmailVerificationNotice email={user.email} locale={safeLocale}/>}<div className="buyerWorkspaceContent">{children}</div><aside className="buyerWorkspaceQuickActions" aria-label={p("quickActions")}><DashboardQuickAction label={p("viewOrders")} href={`/${locale}/account/orders`} icon={ReceiptText}/><DashboardQuickAction label={p("myMessages")} href={`/${locale}/messages`} icon={MessageCircle}/><DashboardQuickAction label={common("account")} href={`/${locale}/account`} icon={Settings}/><DashboardQuickAction label={common("sell")} href={`/${locale}/sell#plans`} icon={Store}/></aside></div></div></main>;
}
