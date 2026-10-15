import type {ReactNode} from "react";
import SellerDashboardLayout from "./SellerDashboardLayout";
import {prisma} from "@/lib/prisma";
import {sellerStoreChoices}from"@/lib/seller-business-access";

export default async function SellerRouteShell({userId,locale,active,children,storeId}:{userId:string;locale:string;active:"messages"|"notifications"|"account";children:ReactNode;storeId?:string}){
 const user=await prisma.user.findUnique({where:{id:userId},select:{role:true,firstName:true,lastName:true}});
 if(user?.role!=="SELLER")return <>{children}</>;
 const stores=await sellerStoreChoices(prisma,userId),selected=stores.find(store=>store.id===storeId),scopedStoreId=selected?.id;
 const unreadMessages=await prisma.message.count({where:{readAt:null,senderId:{not:userId},conversation:scopedStoreId?{storeId:scopedStoreId}:{OR:[{sellerId:userId},{storeId:{in:stores.map(store=>store.id)}}]}}});
 return <SellerDashboardLayout locale={locale} storeSlug={selected?.slug??stores[0]?.slug} firstName={user.firstName} lastName={user.lastName} active={active} unreadMessages={unreadMessages}>{children}</SellerDashboardLayout>;
}
