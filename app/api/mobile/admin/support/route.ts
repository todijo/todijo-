import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { supportStatuses } from "@/lib/support-request";
import { adminPage } from "@/lib/admin-marketplace";
import type { SupportRequestStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireMobileAdmin(request);
    const url = new URL(request.url);
    const requested = url.searchParams.get("status") ?? "OPEN";
    const status = supportStatuses.includes(requested as SupportRequestStatus) ? requested as SupportRequestStatus : "OPEN";
    const where = { status };
    const total = await prisma.supportRequest.count({ where });
    const paging = adminPage(total, url.searchParams.get("page"));
    const requests = await prisma.supportRequest.findMany({ where, skip: paging.skip, take: paging.take,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        id: true, replyEmail: true, category: true, subject: true, message: true, status: true, locale: true,
        orderId: true, productId: true, createdAt: true, resolutionNote: true,
      } });
    return NextResponse.json({ ...paging, total, requests }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
