import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { EmptyState } from "@/components/FeedbackState";
import { MessageCircle } from "lucide-react";
import DashboardReturnLink from "@/components/DashboardReturnLink";

export const dynamic = "force-dynamic";
export default async function MessagesPage() {
  const [common, dashboard, market, locale, session] = await Promise.all([getTranslations("Common"), getTranslations("Dashboard"), getTranslations("Marketplace"), getLocale(), readSession()]);
  if (!session) redirect("/login?next=/messages");
  const [, conversations] = await Promise.all([
    prisma.notification.updateMany({ where: { userId: session.userId, type: "NEW_MESSAGE", readAt: null }, data: { readAt: new Date() } }),
    prisma.conversation.findMany({
      where: { OR: [{ buyerId: session.userId }, { sellerId: session.userId }] },
      orderBy: { lastMessageAt: "desc" },
      select: { id:true, buyerId:true, lastMessageAt:true, product:{select:{name:true,images:true}}, store:{select:{name:true}}, buyer:{select:{firstName:true,lastName:true}}, seller:{select:{firstName:true,lastName:true}}, messages:{take:1,orderBy:{createdAt:"desc"},select:{body:true,senderId:true,readAt:true}} }
    }),
  ]);
  return <main className="messagesPage scopedPublicPage"><SiteHeader/><section className="messagesShell"><div className="messagesHeading"><DashboardReturnLink href={`/${locale}/dashboard`} label={session.role === "CUSTOMER" ? dashboard("buyerArea") : dashboard("sellerDashboard")}/><p className="dashboardBadge">{common("messages")}</p><h1>{dashboard("myConversations")}</h1></div>
    <div className="conversationList">{conversations.length===0 ? <EmptyState icon={MessageCircle} title={dashboard("myConversations")} description={dashboard("conversations")} action={<Link className="primary" href={`/${locale}`}>{dashboard("discover")}</Link>}/> : conversations.map(c=>{const other=c.buyerId===session.userId?c.seller:c.buyer; const last=c.messages[0]; const unread=last && last.senderId!==session.userId && !last.readAt; return <Link className={`conversationCard ${unread?"isUnread":""}`} href={`/${locale}/messages/${c.id}`} key={c.id}><div className="conversationImage">{c.product.images[0]?<Image src={c.product.images[0]} alt="" width={68} height={68} unoptimized/>:<span>📦</span>}</div><div><div className="conversationMeta"><strong>{other.firstName} {other.lastName}</strong><time>{c.lastMessageAt.toLocaleDateString(locale)}</time></div><h2>{c.product.name}</h2><p>{last?.body || common("messages")}</p><small>{c.store.name}</small></div>{unread&&<span className="unreadDot" aria-label={market("newest")}/>}</Link>})}</div>
  </section><MarketplaceFooter /></main>;
}
