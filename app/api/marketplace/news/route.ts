import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { newsTranslationReadLocales, resolveNewsContent } from "@/lib/news-localization";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale"), locale = isLocale(requested) ? requested : "fr", now = new Date();
  const articles = await prisma.newsArticle.findMany({ where: { published: true, publishedAt: { lte: now } }, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, locale: true, title: true, content: true, publishedAt: true } });
  const translations = articles.length ? await prisma.newsArticleTranslation.findMany({ where: { articleId: { in: articles.map(article => article.id) }, locale: { in: newsTranslationReadLocales(locale) } }, select: { articleId: true, locale: true, title: true, content: true, automatic: true } }) : [];
  return NextResponse.json({ locale, articles: articles.map(article => { const value = resolveNewsContent({ ...article, translations: translations.filter(item => item.articleId === article.id) }, locale); return { id: article.id, title: value.title, publishedAt: article.publishedAt?.toISOString() ?? null }; }) }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } });
}
