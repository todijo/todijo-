import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export default async function MessagesPage() {
  const common = await getTranslations("Common"); const dashboard = await getTranslations("Dashboard"); const market = await getTranslations("Marketplace"); const locale = await getLocale();
  const session = await readSession();
  if (!session) redirect("/login?next=/messages");
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: session.userId }, { sellerId: session.userId }] },
    orderBy: { lastMessageAt: "desc" },
    select: { id:true, buyerId:true, lastMessageAt:true, product:{select:{name:true,images:true}}, store:{select:{name:true}}, buyer:{select:{firstName:true,lastName:true}}, seller:{select:{firstName:true,lastName:true}}, messages:{take:1,orderBy:{createdAt:"desc"},select:{body:true,senderId:true,readAt:true}} }
  });
  return <main><SiteHeader/><section className="messagesShell"><div className="messagesHeading"><p className="dashboardBadge">{common("messages")}</p><h1>{dashboard("myConversations")}</h1></div>
    <div className="conversationList">{conversations.length===0 ? <div className="emptyMessages"><h2>{dashboard("conversations")}</h2><Link href="/">{dashboard("discover")}</Link></div> : conversations.map(c=>{const other=c.buyerId===session.userId?c.seller:c.buyer; const last=c.messages[0]; const unread=last && last.senderId!==session.userId && !last.readAt; return <Link className={`conversationCard ${unread?"isUnread":""}`} href={`/messages/${c.id}`} key={c.id}><div className="conversationImage">{c.product.images[0]?<img src={c.product.images[0]} alt=""/>:<span>📦</span>}</div><div><div className="conversationMeta"><strong>{other.firstName} {other.lastName}</strong><time>{c.lastMessageAt.toLocaleDateString(locale)}</time></div><h2>{c.product.name}</h2><p>{last?.body || common("messages")}</p><small>{c.store.name}</small></div>{unread&&<span className="unreadDot" aria-label={market("newest")}/>}</Link>})}</div>
  </section></main>;
}
