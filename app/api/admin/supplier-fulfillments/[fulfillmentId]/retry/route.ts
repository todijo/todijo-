import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { recoverSupplierFulfillment } from "@/lib/suppliers/supplier-fulfillment";

export async function POST(_request: Request, context: { params: Promise<{ fulfillmentId: string }> }) {
  try { await requireAdmin(prisma, await readSession()); } catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
  const { fulfillmentId } = await context.params;
  try { return NextResponse.json(await recoverSupplierFulfillment(prisma, fulfillmentId)); }
  catch (error) {
    const code = error instanceof Error ? error.message : "FULFILLMENT_RETRY_FAILED";
    return NextResponse.json({ error: code === "FULFILLMENT_NOT_FOUND" ? code : "FULFILLMENT_NOT_RETRYABLE" }, { status: code === "FULFILLMENT_NOT_FOUND" ? 404 : 409 });
  }
}
