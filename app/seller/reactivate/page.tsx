import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerLifecycleCopy } from "@/i18n/seller-lifecycle";
import SellerReactivationForm from "./SellerReactivationForm";

export const dynamic="force-dynamic";
export default async function SellerReactivationPage(){
  const [session,locale]=await Promise.all([readSession(),getLocale()]);if(!session)redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/seller/reactivate`)}`);
  const business=await prisma.sellerBusiness.findUnique({where:{ownerId:session.userId},select:{sellerClosedAt:true,reactivationStockReviewRequired:true,owner:{select:{role:true}},stores:{orderBy:{id:"asc"},select:{products:{where:{removedAt:null},orderBy:{id:"asc"},select:{id:true,name:true,stock:true,variants:{where:{active:true},orderBy:{id:"asc"},select:{id:true,values:{select:{optionValue:{select:{value:true}}}},stock:true}}}}}}}});
  if(!business)redirect(`/${locale}/sell#plans`);
  if(business.sellerClosedAt&&session.role!=="CUSTOMER")redirect(`/${locale}/dashboard`);
  if(!business.sellerClosedAt&&(!business.reactivationStockReviewRequired||session.role!=="SELLER"))redirect(`/${locale}/dashboard`);
  const products=business.sellerClosedAt?[]:business.stores.flatMap(store=>store.products.map(product=>({...product,variants:product.variants.map(variant=>({...variant,name:variant.values.map(item=>item.optionValue.value).join(" / ")||"—"}))})));
  return <main className="authPage"><section className="authCard"><SellerReactivationForm products={products} closed={Boolean(business.sellerClosedAt)} copy={sellerLifecycleCopy(locale)}/></section></main>;
}
