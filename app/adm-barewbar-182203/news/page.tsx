import Link from "next/link";
import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import NewsAdmin from "@/components/NewsAdmin";
import {requireAdmin} from "@/lib/admin-access";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {isLocale} from "@/i18n/config";
export const dynamic="force-dynamic";export const metadata={robots:{index:false,follow:false}};
export default async function NewsAdminPage(){const requested=await getLocale(),locale=isLocale(requested)?requested:"en",session=await readSession();if(!session)redirect(`/${locale}/login`);try{await requireAdmin(prisma,session)}catch{redirect(`/${locale}/dashboard`)}const articles=await prisma.newsArticle.findMany({orderBy:{updatedAt:"desc"},select:{id:true,locale:true,title:true,content:true,published:true,publishedAt:true,updatedAt:true,translations:{select:{locale:true,title:true,content:true}}}});return <main className="adminPage cmsAdminPage"><section className="adminShell"><header className="adminHero"><div><span>CMS</span><h1>Todijo Actualités</h1><p>Créez, modifiez, publiez ou supprimez les actualités Todijo.</p></div><Link href="/adm-barewbar-182203">Retour</Link></header><NewsAdmin initialLocale={locale} articles={articles.map(article=>({...article,publishedAt:article.publishedAt?.toISOString()??null,updatedAt:article.updatedAt.toISOString()}))}/></section></main>}
