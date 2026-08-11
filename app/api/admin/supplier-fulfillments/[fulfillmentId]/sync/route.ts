import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { syncSupplierFulfillment } from "@/lib/suppliers/supplier-fulfillment";

export async function POST(_request: Request, context: { params: Promise<{ fulfillmentId: string }> }) {
  try { await requireAdmin(prisma, await readSession()); } catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
  const { fulfillmentId } = await context.params;
  try {
    const detail = await syncSupplierFulfillment(prisma, fulfillmentId);
    return NextResponse.json({ status: detail.status, trackingCount: detail.tracking.length });
  } catch (error) {
    console.error("[cj-fulfillment]", JSON.stringify({ event: "admin_sync_failed", fulfillmentId, error: error instanceof Error ? error.message : "SYNC_FAILED" }));
    return NextResponse.json({ error: "SUPPLIER_SYNC_FAILED" }, { status: 409 });
  }
}
