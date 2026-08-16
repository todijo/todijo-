import type { Prisma, UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import AdminUserActions from "@/components/AdminUserActions";
import { adminUserManagementMessages } from "@/i18n/admin-user-management";
import { isLocale } from "@/i18n/config";
import { isEffectiveBlock } from "@/lib/account-status";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic="force-dynamic";
type Params=Promise<Record<string,string|string[]|undefined>>;
const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??"":value??"";

export default async function AdminUsers({searchParams}:{searchParams:Params}){
  const[requestedLocale,session,params]=await Promise.all([getLocale(),readSession(),searchParams]);
  const locale=isLocale(requestedLocale)?requestedLocale:"en",text=adminUserManagementMessages[locale];
  if(!session)redirect(`/${locale}/login`);
  try{await requireAdmin(prisma,session)}catch{redirect(`/${locale}/dashboard`)}
  const q=one(params.q).trim().slice(0,100),role=one(params.role),status=one(params.status),now=new Date();
  const where:Prisma.UserWhereInput={
    ...(q?{OR:[{email:{contains:q,mode:"insensitive"}},{firstName:{contains:q,mode:"insensitive"}},{lastName:{contains:q,mode:"insensitive"}}]}:{}),
    ...(["CUSTOMER","SELLER","ADMIN"].includes(role)?{role:role as UserRole}:{}),
    ...(status==="BLOCKED"?{blockedAt:{not:null},OR:[{blockExpiresAt:null},{blockExpiresAt:{gt:now}}]}:status==="SUSPENDED"?{sellerSuspendedAt:{not:null}}:status==="ANONYMIZED"?{deactivatedAt:{not:null}}:status==="ACTIVE"?{deactivatedAt:null,AND:[{OR:[{blockedAt:null},{blockExpiresAt:{lte:now}}]}]}:{})
  };
  const users=await prisma.user.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:100,select:{id:true,firstName:true,lastName:true,email:true,role:true,blockedAt:true,blockExpiresAt:true,sellerSuspendedAt:true,deactivatedAt:true,store:{select:{name:true}},_count:{select:{orders:true,reviews:true,adminActionsReceived:true}}}});
  const roleLabel=(value:UserRole)=>value==="CUSTOMER"?text.customer:value==="SELLER"?text.seller:text.admin;
  return <main className="adminPage adminUsersPage"><section className="adminShell"><header className="adminHero"><div><span>{text.eyebrow}</span><h1>{text.title}</h1><p>{text.intro}</p></div><Link href="/adm-barewbar-182203">{text.backAdmin}</Link></header><section className="adminPanel adminTablePanel adminUsersPanel"><form className="adminForm adminUserFilters" action="/adm-barewbar-182203/users"><label>{text.search}<input name="q" maxLength={100} defaultValue={q}/></label><label>{text.role}<select name="role" defaultValue={role}><option value="">{text.allRoles}</option><option value="CUSTOMER">{text.customer}</option><option value="SELLER">{text.seller}</option><option value="ADMIN">{text.admin}</option></select></label><label>{text.status}<select name="status" defaultValue={status}><option value="">{text.allStatuses}</option><option value="ACTIVE">{text.active}</option><option value="BLOCKED">{text.blocked}</option><option value="SUSPENDED">{text.sellerSuspended}</option><option value="ANONYMIZED">{text.anonymized}</option></select></label><button>{text.filter}</button></form><div className="adminTableWrap adminUsersTableWrap"><table className="adminUsersTable"><thead><tr><th>{text.user}</th><th>{text.role}</th><th>{text.status}</th><th>{text.protectedRecords}</th><th>{text.actions}</th></tr></thead><tbody>{users.map(user=>{const blocked=isEffectiveBlock(user,now),statusLabel=user.deactivatedAt?text.anonymized:blocked?text.blocked:user.sellerSuspendedAt?text.sellerSuspended:text.active;return <tr key={user.id}><td data-label={text.user}><div className="adminUserIdentity"><strong>{user.firstName} {user.lastName}</strong><span className="adminUserEmail" title={user.email}>{user.email}</span>{user.store?.name&&<small>{text.store}: {user.store.name}</small>}<Link href={`/adm-barewbar-182203/users/${user.id}`}>{text.viewDetails}</Link></div></td><td data-label={text.role}><span className="adminUserRole">{roleLabel(user.role)}</span></td><td data-label={text.status}><div className="adminUserStatus"><span className={`adminBadge adminUserStatus-${user.deactivatedAt?"anonymized":blocked?"blocked":user.sellerSuspendedAt?"suspended":"active"}`}>{statusLabel}</span>{blocked&&user.blockExpiresAt&&<small>{text.until} {user.blockExpiresAt.toLocaleString(locale)}</small>}</div></td><td data-label={text.protectedRecords}><dl className="adminUserRecordCounts"><div><dt>{text.orders}</dt><dd>{user._count.orders}</dd></div><div><dt>{text.reviews}</dt><dd>{user._count.reviews}</dd></div><div><dt>{text.auditEvents}</dt><dd>{user._count.adminActionsReceived}</dd></div></dl></td><td data-label={text.actions}><AdminUserActions userId={user.id} isProtected={user.id===session.userId} isBlocked={blocked} isSeller={user.role==="SELLER"} isSellerSuspended={Boolean(user.sellerSuspendedAt)} isAnonymized={Boolean(user.deactivatedAt)}/></td></tr>})}</tbody></table></div>{!users.length&&<p className="adminUsersEmpty">{text.noUsers}</p>}</section></section></main>;
}
