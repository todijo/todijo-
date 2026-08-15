import type {ReactNode} from "react";
import SellerDashboardLayout from "./SellerDashboardLayout";
import {prisma} from "@/lib/prisma";

export default async function SellerRouteShell({userId,locale,active,children}:{userId:string;locale:string;active:"messages"|"account";children:ReactNode}){
 const user=await prisma.user.findUnique({where:{id:userId},select:{role:true,firstName:true,lastName:true,store:{select:{slug:true}}}});
 if(user?.role!=="SELLER")return <>{children}</>;
 const unreadMessages=await prisma.message.count({where:{readAt:null,senderId:{not:userId},conversation:{sellerId:userId}}});
 return <SellerDashboardLayout locale={locale} storeSlug={user.store?.slug} firstName={user.firstName} lastName={user.lastName} active={active} unreadMessages={unreadMessages}>{children}</SellerDashboardLayout>;
}
