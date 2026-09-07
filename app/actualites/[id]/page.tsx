import Link from "next/link";
import {notFound} from "next/navigation";
import {getLocale} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SafeSiteContent from "@/components/SafeSiteContent";
import {prisma} from "@/lib/prisma";
import {isLocale} from "@/i18n/config";
import {newsMessages} from "@/i18n/news";
export const dynamic="force-dynamic";
export default async function ArticlePage({params}:{params:Promise<{id:string}>}){const requested=await getLocale(),locale=isLocale(requested)?requested:"en",copy=newsMessages[locale],{id}=await params,article=await prisma.newsArticle.findFirst({where:{id,published:true,publishedAt:{lte:new Date()}},select:{title:true,content:true,publishedAt:true,translations:{where:{locale},select:{title:true,content:true},take:1}}});if(!article)notFound();const localized=article.translations[0]??article;return <main className="scopedPublicPage newsArticlePage"><SiteHeader/><article className="newsArticleShell"><Link href={`/${locale}/actualites`}>{copy.back}</Link>{article.publishedAt&&<time dateTime={article.publishedAt.toISOString()}>{article.publishedAt.toLocaleDateString(locale)}</time>}<SafeSiteContent title={localized.title} content={localized.content}/></article><MarketplaceFooter/></main>}
