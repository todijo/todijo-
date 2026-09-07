import Link from "next/link";
import {getLocale} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import {prisma} from "@/lib/prisma";
import {isLocale} from "@/i18n/config";
import {newsMessages} from "@/i18n/news";
export const dynamic="force-dynamic";
export default async function NewsPage(){const requested=await getLocale(),locale=isLocale(requested)?requested:"en",copy=newsMessages[locale],articles=await prisma.newsArticle.findMany({where:{published:true,publishedAt:{lte:new Date()}},orderBy:{publishedAt:"desc"},select:{id:true,title:true,publishedAt:true,translations:{where:{locale},select:{title:true},take:1}}});return <main className="scopedPublicPage newsPage"><SiteHeader/><section className="newsShell"><header><span>Todijo</span><h1>{copy.title}</h1></header>{articles.length?<div className="newsHeadlineList">{articles.map(article=><article key={article.id}><Link href={`/${locale}/actualites/${article.id}`} target="_blank" rel="noopener noreferrer">{article.translations[0]?.title??article.title}</Link>{article.publishedAt&&<time dateTime={article.publishedAt.toISOString()}>{article.publishedAt.toLocaleDateString(locale)}</time>}</article>)}</div>:<p>{copy.empty}</p>}</section><MarketplaceFooter/></main>}
