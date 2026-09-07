import Link from "next/link";
import {getLocale} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import {prisma} from "@/lib/prisma";
import {isLocale} from "@/i18n/config";
import {newsMessages} from "@/i18n/news";
import {resolveNewsContent} from "@/lib/news-localization";
export const dynamic="force-dynamic";
export default async function NewsPage(){const requested=await getLocale(),locale=isLocale(requested)?requested:"en",copy=newsMessages[locale],articles=await prisma.newsArticle.findMany({where:{published:true,publishedAt:{lte:new Date()}},orderBy:{publishedAt:"desc"},select:{id:true,locale:true,title:true,content:true,publishedAt:true,translations:{select:{locale:true,title:true,content:true,automatic:true}}}});return <main className="scopedPublicPage newsPage"><SiteHeader/><section className="newsShell"><header><span>Todijo</span><h1>{copy.title}</h1></header>{articles.length?<div className="newsHeadlineList">{articles.map(article=><article key={article.id}><Link href={`/${locale}/actualites/${article.id}`} target="_blank" rel="noopener noreferrer">{resolveNewsContent(article,locale).title}</Link>{article.publishedAt&&<time dateTime={article.publishedAt.toISOString()}>{article.publishedAt.toLocaleDateString(locale)}</time>}</article>)}</div>:<p>{copy.empty}</p>}</section><MarketplaceFooter/></main>}
