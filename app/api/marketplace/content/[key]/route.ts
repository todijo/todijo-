import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { getPublishedSiteContent, SiteContentError, siteContentDefinition } from "@/lib/site-content";

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    siteContentDefinition(key);
    const requested = new URL(request.url).searchParams.get("locale");
    const locale = isLocale(requested) ? requested : "fr";
    const exact = await getPublishedSiteContent(prisma, key, locale);
    const fallback = exact ?? (locale === "en" ? null : await getPublishedSiteContent(prisma, key, "en"));
    if (!fallback) return NextResponse.json({ error: "CONTENT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ content: { key, locale: fallback.locale, requestedLocale: locale, fallback: fallback.locale !== locale, title: fallback.title, content: fallback.content, publishedAt: fallback.publishedAt?.toISOString() ?? null } }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
  } catch (error) {
    if (error instanceof SiteContentError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "CONTENT_UNAVAILABLE" }, { status: 500 });
  }
}
