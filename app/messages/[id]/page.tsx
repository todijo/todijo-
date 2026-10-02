import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import MessageComposer from "@/components/MessageComposer";
import SellerRouteShell from "@/components/SellerRouteShell";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { conversationForUser } from "@/lib/conversation-messages";
import { requireStoreCapability } from "@/lib/seller-business-access";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function ConversationPage({ params }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [locale, common, dashboard, productText] = await Promise.all([
    getLocale(),
    getTranslations("Common"),
    getTranslations("Dashboard"),
    getTranslations("Product"),
  ]);
  const conversation = await conversationForUser(prisma,id,session.userId);
  if (!conversation) notFound();
  await Promise.all([
    prisma.message.updateMany({ where: { conversationId: id, senderId: { not: session.userId }, readAt: null }, data: { readAt: new Date() } }),
    prisma.notification.updateMany({ where: { userId: session.userId, href: { endsWith: `/messages/${id}` }, readAt: null }, data: { readAt: new Date() } }),
  ]);
  const other = conversation.buyerId === session.userId ? conversation.seller : conversation.buyer;
  let canReply=conversation.buyerId===session.userId||conversation.sellerId===session.userId;if(!canReply)try{await requireStoreCapability(prisma,session.userId,conversation.storeId,"MESSAGE_REPLY");canReply=true}catch{}

  const content=<section className="threadShell">
      <nav className="threadNavigation" aria-label={common("messages")}><Link className="threadBack" href={`/${locale}/messages`}>← {dashboard("myConversations")}</Link><Link className="threadBack" href={`/${locale}/dashboard`}>{conversation.buyerId === session.userId ? dashboard("buyerArea") : dashboard("sellerDashboard")} →</Link></nav>
      <header className="threadHeader">
        <div className="conversationImage">{conversation.product.images[0] ? <img src={conversation.product.images[0]} alt=""/> : <span>📦</span>}</div>
        <div><p>{common("messages")} · {other.firstName} {other.lastName}</p><h1 dir="auto">{conversation.product.name}</h1><Link href={`/${locale}/product/${conversation.product.id}`}>{Number(conversation.product.price).toFixed(2)} {conversation.product.currency} · {common("view")}</Link></div>
      </header>
      <div className="threadPrivacy">🔒 {productText("private")}</div>
      <div className="messageThread">{conversation.messages.map((message) => <div className={`messageBubble ${message.senderId === session.userId ? "mine" : "theirs"}`} key={message.id}><p>{message.body}</p><time>{message.createdAt.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></div>)}</div>
      {canReply&&<MessageComposer conversationId={id}/>}
    </section>;
  if(session.role==="SELLER")return <SellerRouteShell userId={session.userId} locale={locale} active="messages">{content}</SellerRouteShell>;
  return <BuyerDashboardLayout locale={locale} active="messages"><div className="conversationPage scopedPublicPage">{content}</div></BuyerDashboardLayout>;
}
