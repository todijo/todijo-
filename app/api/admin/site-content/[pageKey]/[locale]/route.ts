import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readAdminRequestSession } from "@/lib/admin-request-session";
import { archiveSiteContent, publishSiteContent, restoreSiteContent, saveSiteContent, siteContentErrorResponse } from "@/lib/site-content";

function errorResponse(error: unknown) {
  const value = siteContentErrorResponse(error);
  return NextResponse.json(value.body, { status: value.status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ pageKey: string; locale: string }> }) {
  try {
    const { pageKey, locale } = await params;
    const result = await saveSiteContent(prisma, await readAdminRequestSession(request), pageKey, locale, await request.json());
    return NextResponse.json(result);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ pageKey: string; locale: string }> }) {
  try {
    const { pageKey, locale } = await params;
    const body = await request.json();
    const session = await readAdminRequestSession(request);
    await requireAdmin(prisma, session);
    const version = Number(body.expectedVersion);
    if (body.action === "publish") return NextResponse.json({ revision: await publishSiteContent(prisma, session, pageKey, locale, String(body.revisionId ?? ""), version), version: version + 1 });
    if (body.action === "archive") { await archiveSiteContent(prisma, session, pageKey, locale, version); return NextResponse.json({ ok: true, version: version + 1 }); }
    if (body.action === "restore") return NextResponse.json(await restoreSiteContent(prisma, session, pageKey, locale, String(body.revisionId ?? ""), version));
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}
