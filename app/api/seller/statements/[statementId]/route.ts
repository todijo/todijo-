import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerPrincipals } from "@/lib/seller-business-access";
import { sellerMonthlyStatementCsv } from "@/lib/seller-monthly-statements";
import { sellerReportCopy } from "@/i18n/seller-reports";
import { isLocale } from "@/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ statementId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { statementId } = await params;
  if (!statementId || statementId.length > 100) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const statement = await prisma.sellerMonthlyStatement.findUnique({ where: { id: statementId }, include: { business: { select: { ownerId: true, sellerClosedAt: true } } } });
  if (!statement) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const isOwner = statement.business.ownerId === session.userId;
  const principal = isOwner ? null : (await sellerPrincipals(prisma, session.userId)).find((candidate) => candidate.businessId === statement.businessId && candidate.storeIds.includes(statement.storeId));
  if (!isOwner && (!principal || !principal.permissions.includes("SALES_VIEW") || statement.business.sellerClosedAt)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const localeParam = new URL(request.url).searchParams.get("locale") ?? "en";
  const locale = isLocale(localeParam) ? localeParam : "en";
  try {
    await prisma.sellerBusinessAuditEvent.create({ data: { businessId: statement.businessId, storeId: statement.storeId, actorId: session.userId, category: "FINANCIAL_DOCUMENT", action: "MONTHLY_STATEMENT_DOWNLOADED", targetType: "SellerMonthlyStatement", targetId: statement.id, metadata: { revision: statement.revision, year: statement.year, month: statement.month, currency: statement.currency } } });
  } catch {
    return NextResponse.json({ error: "STATEMENT_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  const body = sellerMonthlyStatementCsv(statement, sellerReportCopy(locale));
  return new Response(`\uFEFF${body}`, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="todijo-statement-${statement.year}-${String(statement.month).padStart(2, "0")}-${statement.currency}-r${statement.revision}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
