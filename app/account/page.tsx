import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import AccountSettings from "./AccountSettings";
import BuyerDashboardLayout from "@/components/BuyerDashboardLayout";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";

export const dynamic="force-dynamic";
export default async function AccountPage(){
 const [session,locale]=await Promise.all([readSession(),getLocale()]);if(!session)redirect("/login?next=/account");
 const user=await prisma.user.findUnique({where:{id:session.userId},select:{firstName:true,lastName:true,email:true,role:true,phone:true,profileAddress:true,profilePostalCode:true,profileCity:true,profileCountry:true,emailVerified:true,passwordHash:true,store:{select:{slug:true}},teamMemberships:{where:{status:{in:["ACTIVE","SUSPENDED"]}},take:1,select:{id:true}},oauthAccounts:{select:{provider:true}},shippingAddresses:{orderBy:[{isDefault:"desc"},{createdAt:"asc"},{id:"asc"}],take:1,select:{recipientName:true,addressLine1:true,addressLine2:true,postalCode:true,city:true,country:true,state:true,phone:true,isDefault:true}}}});if(!user)redirect("/login");
 const shippingAddresses=user.shippingAddresses;
 const profile=<AccountSettings isBuyer={user.role==="CUSTOMER"} defaultAddress={shippingAddresses[0]??null} profile={{firstName:user.firstName,lastName:user.lastName,email:user.email,phone:user.phone,profileAddress:user.profileAddress,profilePostalCode:user.profilePostalCode,profileCity:user.profileCity,profileCountry:user.profileCountry,emailVerified:user.emailVerified,hasPassword:Boolean(user.passwordHash),managedTeamAccount:user.teamMemberships.length>0,providers:user.oauthAccounts.map(item=>item.provider)}}/>;
 if(user.role==="SELLER")return <SellerDashboardLayout locale={locale} storeSlug={user.store?.slug} firstName={user.firstName} lastName={user.lastName} active="account">{profile}</SellerDashboardLayout>;
 return <BuyerDashboardLayout locale={locale} active="account">{profile}</BuyerDashboardLayout>;
}
