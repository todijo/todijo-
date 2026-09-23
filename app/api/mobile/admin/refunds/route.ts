import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { adminPage } from "@/lib/admin-marketplace";
import type { RefundRequestStatus } from "@prisma/client";

const statuses: RefundRequestStatus[] = ["PENDING", "SELLER_APPROVED", "SELLER_REJECTED", "ADMIN_APPROVED", "ADMIN_REJECTED"];
export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const requested = url.searchParams.get("status") ?? "";
    const where = { status: { in: statuses.includes(requested as RefundRequestStatus) ? [requested as RefundRequestStatus] : ["SELLER_APPROVED", "SELLER_REJECTED"] as RefundRequestStatus[] } };
    const total = await prisma.refundRequest.count({ where });
    const paging = adminPage(total, url.searchParams.get("page"));
    const refunds = await prisma.refundRequest.findMany({ where, skip: paging.skip, take: paging.take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
        id: true, orderId: true, reason: true, status: true, createdAt: true, decisionNote: true,
        buyer: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { total: true, currency: true, status: true } },
        refundOperation: { select: { status: true } },
        evidence: { select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true } },
      } });
    return NextResponse.json({ ...paging, total, refunds: refunds.map(item => ({ ...item,
      order: { ...item.order, total: item.order.total.toString() } })) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
