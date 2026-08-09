import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MessageComposer from "@/components/MessageComposer";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

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
  const conversation = await prisma.conversation.findFirst({
    where: { id, OR: [{ buyerId: session.userId }, { sellerId: session.userId }] },
    select: {
      id: true, buyerId: true,
      product: { select: { id: true, name: true, images: true, price: true, currency: true } },
      store: { select: { name: true, slug: true } },
      buyer: { select: { firstName: true, lastName: true } },
      seller: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, senderId: true, createdAt: true } },
    },
  });
  if (!conversation) notFound();
  await Promise.all([
    prisma.message.updateMany({ where: { conversationId: id, senderId: { not: session.userId }, readAt: null }, data: { readAt: new Date() } }),
    prisma.notification.updateMany({ where: { userId: session.userId, href: { endsWith: `/messages/${id}` }, readAt: null }, data: { readAt: new Date() } }),
  ]);
  const other = conversation.buyerId === session.userId ? conversation.seller : conversation.buyer;

  return <main className="conversationPage scopedPublicPage">
    <SiteHeader storeName={conversation.store.name} storeSlug={conversation.store.slug}/>
    <section className="threadShell">
      <nav className="threadNavigation" aria-label={common("messages")}><Link className="threadBack" href={`/${locale}/messages`}>← {dashboard("myConversations")}</Link><Link className="threadBack" href={`/${locale}/dashboard`}>{conversation.buyerId === session.userId ? dashboard("buyerArea") : dashboard("sellerDashboard")} →</Link></nav>
      <header className="threadHeader">
        <div className="conversationImage">{conversation.product.images[0] ? <img src={conversation.product.images[0]} alt=""/> : <span>📦</span>}</div>
        <div><p>{common("messages")} · {other.firstName} {other.lastName}</p><h1 dir="auto">{conversation.product.name}</h1><Link href={`/${locale}/product/${conversation.product.id}`}>{Number(conversation.product.price).toFixed(2)} {conversation.product.currency} · {common("view")}</Link></div>
      </header>
      <div className="threadPrivacy">🔒 {productText("private")}</div>
      <div className="messageThread">{conversation.messages.map((message) => <div className={`messageBubble ${message.senderId === session.userId ? "mine" : "theirs"}`} key={message.id}><p>{message.body}</p><time>{message.createdAt.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></div>)}</div>
      <MessageComposer conversationId={id}/>
    </section>
    <MarketplaceFooter />
  </main>;
}
