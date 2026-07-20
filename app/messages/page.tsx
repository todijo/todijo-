import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function MessagesPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/messages");
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: session.userId }, { sellerId: session.userId }] },
    orderBy: { lastMessageAt: "desc" },
    select: { id:true, buyerId:true, lastMessageAt:true, product:{select:{name:true,images:true}}, store:{select:{name:true}}, buyer:{select:{firstName:true,lastName:true}}, seller:{select:{firstName:true,lastName:true}}, messages:{take:1,orderBy:{createdAt:"desc"},select:{body:true,senderId:true,readAt:true}} }
  });
  return <main><SiteHeader/><section className="messagesShell"><div className="messagesHeading"><p className="dashboardBadge">Messagerie privée</p><h1>Mes conversations</h1><p>Les adresses e-mail des acheteurs et vendeurs ne sont jamais affichées.</p></div>
    <div className="conversationList">{conversations.length===0 ? <div className="emptyMessages"><h2>Aucune conversation</h2><p>Utilisez « Demander au vendeur » sur une fiche produit.</p><Link href="/">Découvrir les produits</Link></div> : conversations.map(c=>{const other=c.buyerId===session.userId?c.seller:c.buyer; const last=c.messages[0]; const unread=last && last.senderId!==session.userId && !last.readAt; return <Link className={`conversationCard ${unread?"isUnread":""}`} href={`/messages/${c.id}`} key={c.id}><div className="conversationImage">{c.product.images[0]?<img src={c.product.images[0]} alt=""/>:<span>📦</span>}</div><div><div className="conversationMeta"><strong>{other.firstName} {other.lastName}</strong><time>{c.lastMessageAt.toLocaleDateString("fr-FR")}</time></div><h2>{c.product.name}</h2><p>{last?.body || "Conversation créée"}</p><small>{c.store.name}</small></div>{unread&&<span className="unreadDot" aria-label="Non lu"/>}</Link>})}</div>
  </section></main>;
}
