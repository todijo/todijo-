import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { newsTranslationReadLocales, resolveNewsContent } from "@/lib/news-localization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, requested = new URL(request.url).searchParams.get("locale"), locale = isLocale(requested) ? requested : "fr";
  const article = await prisma.newsArticle.findFirst({ where: { id, published: true, publishedAt: { lte: new Date() } }, select: { id: true, locale: true, title: true, content: true, publishedAt: true } });
  if (!article) return NextResponse.json({ error: "NEWS_NOT_FOUND" }, { status: 404 });
  const translations = await prisma.newsArticleTranslation.findMany({ where: { articleId: id, locale: { in: newsTranslationReadLocales(locale) } }, select: { locale: true, title: true, content: true, automatic: true } });
  const value = resolveNewsContent({ ...article, translations }, locale);
  return NextResponse.json({ article: { id, title: value.title, content: value.content, publishedAt: article.publishedAt?.toISOString() ?? null } }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } });
}
