import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner } from "@/lib/seller-business-access";
import { sellerTeamCopy } from "@/i18n/seller-team";
import TeamManagement from "./TeamManagement";

export const dynamic="force-dynamic";
export default async function SellerTeamPage(){const[session,locale]=await Promise.all([readSession(),getLocale()]);if(!session)redirect(`/${locale}/login`);let principal;try{principal=await requireBusinessOwner(prisma,session.userId)}catch{redirect(`/${locale}/dashboard`)}const business=await prisma.sellerBusiness.findUnique({where:{id:principal.businessId},select:{stores:{orderBy:{createdAt:"asc"},select:{id:true,name:true}},memberships:{orderBy:{createdAt:"asc"},select:{id:true,status:true,roleTemplate:true,permissions:true,user:{select:{firstName:true,lastName:true,email:true}},assignments:{select:{storeId:true}}}},invitations:{where:{acceptedAt:null},orderBy:{createdAt:"desc"},select:{id:true,email:true,roleTemplate:true,expiresAt:true,revokedAt:true,stores:{select:{storeId:true}}}}}});const copy=sellerTeamCopy(locale);return <main className="sellerStandalonePage"><header className="sellerTeamHero"><div><span>PRO</span><h1>{copy.title}</h1><p>{copy.intro}</p></div><a href={`/${locale}/dashboard`}>← {copy.dashboard}</a></header>{business&&<TeamManagement locale={locale} copy={copy} stores={business.stores} members={business.memberships} invitations={business.invitations.map(item=>({...item,expiresAt:item.expiresAt.toISOString(),revokedAt:item.revokedAt?.toISOString()??null}))}/>}</main>}
