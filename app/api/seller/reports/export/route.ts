import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { SellerCapabilityError, resolveSellerStoreContext } from "@/lib/seller-business-access";
import { loadSellerFinanceExportRows, loadSellerStockExportRows, parseSellerReportMonth, sellerFinanceCsv, sellerReportMonthBounds, sellerStockCsv } from "@/lib/seller-report-export";
import { sellerReportCopy } from "@/i18n/seller-reports";
import { isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvResponse(body: string, filename: string) {
  return new Response(`\uFEFF${body}`, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const localeParam = url.searchParams.get("locale") ?? "en";
  const locale = isLocale(localeParam) ? localeParam : "en";
  const storeId = url.searchParams.get("store");
  const permission = type === "finance" ? "SALES_VIEW" : type === "stock" ? "PRODUCT_VIEW" : null;
  if (!permission || !storeId || storeId.length > 100) return NextResponse.json({ error: "INVALID_REPORT_REQUEST" }, { status: 400 });
  try {
    await assertSellerActivity(prisma, session.userId);
    const context = await resolveSellerStoreContext(prisma, session.userId, storeId, permission);
    const safeStoreId = context.selected.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const labels = sellerReportCopy(locale);
    if (type === "finance") {
      const month = parseSellerReportMonth(url.searchParams.get("month"));
      if (!month) return NextResponse.json({ error: "INVALID_REPORT_MONTH" }, { status: 400 });
      const bounds = sellerReportMonthBounds(month.year, month.month);
      const groups = await loadSellerFinanceExportRows(prisma, context.selected.id, bounds.start, bounds.end);
      const body = sellerFinanceCsv(groups, labels);
      return csvResponse(body, `todijo-finance-${month.year}-${String(month.month).padStart(2, "0")}-${safeStoreId}.csv`);
    }
    const stockRows = await loadSellerStockExportRows(prisma, context.selected.id);
    return csvResponse(sellerStockCsv(stockRows, labels), `todijo-stock-${safeStoreId}.csv`);
  } catch (error) {
    if (error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ error: "SELLER_REPORT_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
