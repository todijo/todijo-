import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { defaultLocale, isLocale } from "@/i18n/config";

const statuses = new Set(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]);
const actions = new Set(["NONE", "UNPUBLISH"]);
export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try { await requireAdmin(prisma, session); } catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
  const { reportId } = await params; const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? ""), action = String(body.action ?? ""), note = String(body.note ?? "").trim();
  if (!statuses.has(status) || !actions.has(action) || note.length > 1000) return NextResponse.json({ error: "INVALID_DECISION" }, { status: 400 });
  const result = await prisma.$transaction(async tx => {
    const report = await tx.productReport.findUnique({ where: { id: reportId }, select: { status: true, product: { select: { id: true, name: true, store: { select: { ownerId: true, language: true } } } } } });
    if (!report) return null;
    if (action === "UNPUBLISH") {
      const sellerLocale = isLocale(report.product.store.language) ? report.product.store.language : defaultLocale;
      const t = await getTranslations({ locale: sellerLocale, namespace: "TrustSafety" });
      await tx.product.update({ where: { id: report.product.id }, data: { status: "DRAFT", deactivationReason: "ADMIN" } });
      await tx.notification.create({ data: { userId: report.product.store.ownerId, type: "LISTING_MODERATION", title: t("notificationTitle"), body: t("notificationBody", { product: report.product.name }), href: "/seller/products" } });
    }
    await tx.productReport.update({ where: { id: reportId }, data: { status: status as "UNDER_REVIEW"|"RESOLVED"|"DISMISSED", reviewedById: session.userId, reviewedAt: new Date(), resolutionNote: note || null } });
    await tx.productModerationEvent.create({ data: { reportId, actorId: session.userId, fromStatus: report.status, toStatus: status as "UNDER_REVIEW"|"RESOLVED"|"DISMISSED", action, note: note || null } });
    return true;
  });
  if (result && action === "UNPUBLISH") revalidateTag(PUBLIC_STORES_CACHE_TAG);
  return result ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
