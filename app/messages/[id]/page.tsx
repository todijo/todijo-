import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import MessageComposer from "@/components/MessageComposer";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
type Props={params:Promise<{id:string}>};
export default async function ConversationPage({params}:Props){
 const session=await readSession(); if(!session) redirect("/login"); const {id}=await params;
 const conversation=await prisma.conversation.findFirst({where:{id,OR:[{buyerId:session.userId},{sellerId:session.userId}]},select:{id:true,buyerId:true,product:{select:{id:true,name:true,images:true,price:true,currency:true}},store:{select:{name:true,slug:true}},buyer:{select:{firstName:true,lastName:true}},seller:{select:{firstName:true,lastName:true}},messages:{orderBy:{createdAt:"asc"},select:{id:true,body:true,senderId:true,createdAt:true}}}}); if(!conversation) notFound();
 await prisma.message.updateMany({where:{conversationId:id,senderId:{not:session.userId},readAt:null},data:{readAt:new Date()}});
 const other=conversation.buyerId===session.userId?conversation.seller:conversation.buyer;
 return <main><SiteHeader storeName={conversation.store.name} storeSlug={conversation.store.slug}/><section className="threadShell"><Link className="threadBack" href="/messages">← Mes conversations</Link><header className="threadHeader"><div className="conversationImage">{conversation.product.images[0]?<img src={conversation.product.images[0]} alt=""/>:<span>📦</span>}</div><div><p>Conversation avec {other.firstName} {other.lastName}</p><h1>{conversation.product.name}</h1><Link href={`/product/${conversation.product.id}`}>{Number(conversation.product.price).toFixed(2)} {conversation.product.currency} · Voir le produit</Link></div></header><div className="threadPrivacy">🔒 Vos coordonnées restent privées. Évitez les paiements et échanges en dehors de Todijo.</div><div className="messageThread">{conversation.messages.map(m=><div className={`messageBubble ${m.senderId===session.userId?"mine":"theirs"}`} key={m.id}><p>{m.body}</p><time>{m.createdAt.toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})}</time></div>)}</div><MessageComposer conversationId={id}/></section></main>
}
