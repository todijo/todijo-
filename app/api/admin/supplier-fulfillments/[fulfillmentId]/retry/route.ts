import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { processSupplierFulfillment } from "@/lib/suppliers/supplier-fulfillment";

export async function POST(_request: Request, context: { params: Promise<{ fulfillmentId: string }> }) {
  try { await requireAdmin(prisma, await readSession()); } catch { return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
  const { fulfillmentId } = await context.params;
  const fulfillment = await prisma.supplierFulfillment.findUnique({ where: { id: fulfillmentId }, select: { status: true } });
  if (!fulfillment) return NextResponse.json({ error: "FULFILLMENT_NOT_FOUND" }, { status: 404 });
  if (fulfillment.status !== "RETRYABLE") return NextResponse.json({ error: "FULFILLMENT_NOT_RETRYABLE" }, { status: 409 });
  return NextResponse.json(await processSupplierFulfillment(prisma, fulfillmentId));
}
