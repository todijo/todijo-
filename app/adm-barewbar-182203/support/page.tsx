import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import AdminSupportRequestAction from "@/components/AdminSupportRequestAction";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { supportStatuses } from "@/lib/support-request";

export const dynamic="force-dynamic";export const metadata={robots:{index:false,follow:false}};
export default async function AdminSupportPage({searchParams}:{searchParams:Promise<{status?:string}>}){
  const locale=await getLocale(),t=await getTranslations("HelpCenter"),session=await readSession();if(!session)redirect(`/${locale}/login`);try{await requireAdmin(prisma,session)}catch{redirect(`/${locale}/dashboard`)}
  const query=await searchParams,status=supportStatuses.includes(query.status as never)?query.status!:"OPEN";
  const requests=await prisma.supportRequest.findMany({where:{status:status as never},orderBy:{createdAt:"asc"},take:100,select:{id:true,replyEmail:true,category:true,subject:true,message:true,status:true,locale:true,orderId:true,productId:true,createdAt:true,user:{select:{id:true,email:true,role:true}}}});
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("eyebrow")}</span><h1>{t("adminTitle")}</h1><p>{t("adminIntro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><nav className="moderationFilters">{supportStatuses.map(value=><Link key={value} href={`/adm-barewbar-182203/support?status=${value}`} aria-current={value===status?"page":undefined}>{value}</Link>)}</nav>{requests.map(item=><article className="adminPanel moderationCard" key={item.id}><div><span className="adminBadge">{item.category}</span><h2>{item.subject}</h2><p dir="auto">{item.message}</p><small>{item.createdAt.toLocaleString(locale)} Â· {item.replyEmail} Â· {item.id}</small>{item.orderId&&<p>Order: {item.orderId}</p>}{item.productId&&<p>Product: {item.productId}</p>}</div><AdminSupportRequestAction requestId={item.id} status={item.status}/></article>)}{!requests.length&&<section className="adminPanel"><p>{t("empty")}</p></section>}</section></main>;
}
