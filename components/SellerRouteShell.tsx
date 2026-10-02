import type {ReactNode} from "react";
import SellerDashboardLayout from "./SellerDashboardLayout";
import {prisma} from "@/lib/prisma";
import {sellerStoreChoices}from"@/lib/seller-business-access";

export default async function SellerRouteShell({userId,locale,active,children}:{userId:string;locale:string;active:"messages"|"notifications"|"account";children:ReactNode}){
 const user=await prisma.user.findUnique({where:{id:userId},select:{role:true,firstName:true,lastName:true}});
 if(user?.role!=="SELLER")return <>{children}</>;
 const stores=await sellerStoreChoices(prisma,userId),unreadMessages=await prisma.message.count({where:{readAt:null,senderId:{not:userId},conversation:{OR:[{sellerId:userId},{storeId:{in:stores.map(store=>store.id)}}]}}});
 return <SellerDashboardLayout locale={locale} storeSlug={stores[0]?.slug} firstName={user.firstName} lastName={user.lastName} active={active} unreadMessages={unreadMessages}>{children}</SellerDashboardLayout>;
}
