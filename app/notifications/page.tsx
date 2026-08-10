import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CheckCircle2, MessageCircle, Package, ShieldAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SiteHeader from "@/components/SiteHeader";
import { MarkAllNotificationsRead, NotificationLink } from "@/components/NotificationActions";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const PAGE_SIZE = 20;
const locales = ["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"];
function pageNumber(value?: string) { const parsed=Number(value); return Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,10_000):1; }
function safeHref(locale:string,href:string|null){if(!href||!href.startsWith("/")||href.startsWith("//")||href.includes("\\")||href.startsWith("/api/"))return `/${locale}/dashboard`;const parts=href.split("/").filter(Boolean);return `/${locale}/${(locales.includes(parts[0])?parts.slice(1):parts).join("/")}`;}
function Icon({type}:{type:string}){if(type==="NEW_MESSAGE")return <MessageCircle/>;if(type.includes("ORDER"))return <Package/>;if(type.includes("MODERATION"))return <ShieldAlert/>;return <Bell/>;}

export default async function NotificationsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const [locale,t,events,session,params]=await Promise.all([getLocale(),getTranslations("Notifications"),getTranslations("NotificationEvents"),readSession(),searchParams]);
  if(!session) redirect(`/${locale}/login?next=/${locale}/notifications`);
  const requested=pageNumber(params.page),total=await prisma.notification.count({where:{userId:session.userId}}),pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),page=Math.min(requested,pages);
  const [notifications,unread]=await Promise.all([
    prisma.notification.findMany({where:{userId:session.userId},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE,select:{id:true,type:true,title:true,body:true,href:true,readAt:true,createdAt:true}}),
    prisma.notification.count({where:{userId:session.userId,readAt:null}}),
  ]);
  const display=(item:typeof notifications[number])=>item.type==="ORDER_PAID"?{title:events("orderPaidTitle"),body:events("orderPaidBody")}:item.type==="NEW_ORDER"?{title:events("newOrderTitle"),body:events("newOrderBody")}:item.type==="ORDER_SHIPPED"?{title:events("orderShippedTitle"),body:events("orderShippedBody")}:item.type==="ORDER_DELIVERED"?{title:events("orderDeliveredTitle"),body:events("orderDeliveredBody")}:{title:item.title,body:item.body};
  return <main className="notificationsPage scopedPublicPage"><SiteHeader/><section className="notificationsShell"><header className="notificationsHeading"><div><span>{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("intro")}</p></div>{unread>0&&<MarkAllNotificationsRead/>}</header>{notifications.length===0?<section className="notificationsEmpty"><CheckCircle2/><h2>{t("emptyTitle")}</h2><p>{t("emptyText")}</p><Link href={`/${locale}/dashboard`}>{t("backDashboard")}</Link></section>:<div className="notificationList">{notifications.map(item=>{const copy=display(item);return <article className={item.readAt?"":"isUnread"} key={item.id}><div className="notificationIcon"><Icon type={item.type}/></div><div><div className="notificationMeta"><strong>{copy.title}</strong><time>{item.createdAt.toLocaleString(locale,{dateStyle:"medium",timeStyle:"short"})}</time></div><p>{copy.body}</p>{!item.readAt&&<small>{t("unread")}</small>}</div><NotificationLink id={item.id} href={safeHref(locale,item.href)}>{t("open")}</NotificationLink></article>})}</div>}<nav className="notificationPagination" aria-label={t("pagination")}>{page>1&&<Link href={`/${locale}/notifications?page=${page-1}`}>{t("previous")}</Link>}<span>{t("page",{page,pages})}</span>{page<pages&&<Link href={`/${locale}/notifications?page=${page+1}`}>{t("next")}</Link>}</nav></section><MarketplaceFooter/></main>;
}
