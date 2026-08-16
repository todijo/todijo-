import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import AdminUserActions from "@/components/AdminUserActions";
import { adminUserManagementMessages } from "@/i18n/admin-user-management";
import { isLocale } from "@/i18n/config";
import { isEffectiveBlock } from "@/lib/account-status";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic="force-dynamic";
export default async function AdminUserDetail({params}:{params:Promise<{userId:string}>}){
  const[requestedLocale,session,{userId}]=await Promise.all([getLocale(),readSession(),params]),locale=isLocale(requestedLocale)?requestedLocale:"en",text=adminUserManagementMessages[locale];
  if(!session)redirect(`/${locale}/login`);
  try{await requireAdmin(prisma,session)}catch{redirect(`/${locale}/dashboard`)}
  const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,firstName:true,lastName:true,email:true,role:true,createdAt:true,blockedAt:true,blockExpiresAt:true,sellerSuspendedAt:true,deactivatedAt:true,store:{select:{name:true}},_count:{select:{orders:true,reviews:true}},adminActionsReceived:{orderBy:{createdAt:"desc"},take:100,select:{id:true,action:true,reason:true,previousStatus:true,newStatus:true,blockExpiresAt:true,createdAt:true,correlationId:true,actorAdmin:{select:{firstName:true,lastName:true}}}}}});
  if(!user)notFound();
  const blocked=isEffectiveBlock(user),statusLabel=user.deactivatedAt?text.anonymized:blocked?text.blocked:user.sellerSuspendedAt?text.sellerSuspended:text.active,roleLabel=user.role==="CUSTOMER"?text.customer:user.role==="SELLER"?text.seller:text.admin;
  return <main className="adminPage adminUserDetailPage"><section className="adminShell"><header className="adminHero"><div><span>{text.record}</span><h1>{user.firstName} {user.lastName}</h1><p className="adminUserDetailEmail">{user.email} · {roleLabel}</p></div><Link href="/adm-barewbar-182203/users">{text.backUsers}</Link></header><section className="adminPanel adminUserDetailSummary"><div><strong>{text.status}</strong><span className="adminBadge">{statusLabel}</span></div><p>{text.created} {user.createdAt.toLocaleString(locale)} · {user._count.orders} {text.orders.toLocaleLowerCase(locale)} · {user._count.reviews} {text.reviews.toLocaleLowerCase(locale)}</p>{user.store?.name&&<p>{text.store}: <strong>{user.store.name}</strong></p>}<AdminUserActions userId={user.id} isProtected={user.id===session.userId} isBlocked={blocked} isSeller={user.role==="SELLER"} isSellerSuspended={Boolean(user.sellerSuspendedAt)} isAnonymized={Boolean(user.deactivatedAt)}/></section><section className="adminPanel adminUserAuditPanel"><h2>{text.auditTrail}</h2>{user.adminActionsReceived.map(event=><article className="moderationCard" key={event.id}><strong>{text[event.action]}</strong><p>{event.reason}</p><small>{event.createdAt.toLocaleString(locale)} · {event.actorAdmin.firstName} {event.actorAdmin.lastName} · {event.correlationId??event.id}</small><details><summary>{text.safeStatusChange}</summary><pre>{JSON.stringify({previous:event.previousStatus,next:event.newStatus,blockExpiresAt:event.blockExpiresAt},null,2)}</pre></details></article>)}{!user.adminActionsReceived.length&&<p>{text.noAudit}</p>}</section></section></main>;
}
