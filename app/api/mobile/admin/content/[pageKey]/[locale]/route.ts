import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { siteContentDefinition, validateSiteContentLocale, siteContentErrorResponse } from "@/lib/site-content";

export async function GET(request: Request, context: { params: Promise<{ pageKey: string; locale: string }> }) {
  try {
    await requireMobileAdmin(request);
    const { pageKey, locale: localeValue } = await context.params;
    const definition = siteContentDefinition(pageKey);
    const locale = validateSiteContentLocale(localeValue);
    const page = await prisma.siteContentPage.findUnique({ where: { routeKey: pageKey }, select: {
      version: true, status: true,
      revisions: { where: { locale }, orderBy: { revision: "desc" }, take: 30,
        select: { id: true, revision: true, status: true, title: true, content: true, seoTitle: true, seoDescription: true, createdAt: true, publishedAt: true } },
      publications: { where: { locale }, select: { status: true, revisionId: true } },
    } });
    return NextResponse.json({ key: pageKey, locale, group: definition.group, legal: definition.legal,
      version: page?.version ?? 0, status: page?.status ?? null,
      publication: page?.publications[0] ?? null, revisions: page?.revisions ?? [] },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const specific = siteContentErrorResponse(error);
    if (specific.status !== 500) return NextResponse.json(specific.body, { status: specific.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
