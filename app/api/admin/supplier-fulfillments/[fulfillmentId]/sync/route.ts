import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readAdminRequestSession } from "@/lib/admin-request-session";
import { syncSupplierFulfillment } from "@/lib/suppliers/supplier-fulfillment";

export async function POST(request: Request, context: { params: Promise<{ fulfillmentId: string }> }) {
  try { await requireAdmin(prisma, await readAdminRequestSession(request)); } catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
  const { fulfillmentId } = await context.params;
  try {
    const detail = await syncSupplierFulfillment(prisma, fulfillmentId);
    return NextResponse.json({ status: detail.status, trackingCount: detail.tracking.length });
  } catch (error) {
    console.error("[cj-fulfillment]", JSON.stringify({ event: "admin_sync_failed", fulfillmentId, errorClass: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "SUPPLIER_SYNC_FAILED" }, { status: 409 });
  }
}
