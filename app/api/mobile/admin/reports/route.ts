import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { adminPage } from "@/lib/admin-marketplace";
import type { ProductReportStatus } from "@prisma/client";

const statuses: ProductReportStatus[] = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];
export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const requested = url.searchParams.get("status") ?? "OPEN";
    const where = { status: statuses.includes(requested as ProductReportStatus) ? requested as ProductReportStatus : "OPEN" as ProductReportStatus };
    const total = await prisma.productReport.count({ where });
    const paging = adminPage(total, url.searchParams.get("page"));
    const reports = await prisma.productReport.findMany({ where, skip: paging.skip, take: paging.take,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        id: true, reason: true, details: true, status: true, createdAt: true,
        product: { select: { id: true, name: true, status: true, store: { select: { id: true, name: true, ownerId: true } } } },
        events: { orderBy: { createdAt: "desc" }, take: 5, select: { toStatus: true, action: true, note: true, createdAt: true } },
      } });
    return NextResponse.json({ ...paging, total, reports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
