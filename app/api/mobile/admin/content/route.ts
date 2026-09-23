import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { siteContentPages, validateSiteContentLocale } from "@/lib/site-content";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const locale = validateSiteContentLocale(new URL(request.url).searchParams.get("locale") ?? "fr");
    const rows = await prisma.siteContentPage.findMany({ select: { routeKey: true, groupKey: true, version: true, status: true,
      publications: { where: { locale }, select: { status: true, revision: { select: { id: true, revision: true, title: true } } } },
      revisions: { where: { locale }, orderBy: { revision: "desc" }, take: 1, select: { id: true, revision: true, title: true, status: true } },
    } });
    const byKey = new Map(rows.map(row => [row.routeKey, row]));
    return NextResponse.json({ locale, pages: siteContentPages.map(([key, group, legal]) => {
      const row = byKey.get(key);
      return { key, group, legal, version: row?.version ?? 0, status: row?.status ?? null,
        publication: row?.publications[0] ?? null, latestRevision: row?.revisions[0] ?? null };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
