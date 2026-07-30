import { NextResponse } from "next/server";
import { listBuyerRefundEvidence, listSellerRefundEvidence, RefundEvidenceError, uploadBuyerRefundEvidence } from "@/lib/refund-evidence";
import { getSellerRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { parseEvidenceMultipart } from "@/lib/refund-evidence-multipart";
import { prisma } from "@/lib/prisma";
import { r2ObjectStore } from "@/lib/r2";
import { readSession } from "@/lib/session";

function errorResponse(error: unknown, fallback: string) {
  const known = error instanceof RefundEvidenceError || error instanceof RefundRequestError;
  return NextResponse.json({ error: known ? error.message : fallback }, { status: known ? error.status : 500 });
}

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { orderId } = await context.params;
  try {
    if (session.role === "CUSTOMER") {
      const request = await prisma.refundRequest.findFirst({ where: { orderId, buyerId: session.userId, order: { buyerId: session.userId } }, select: { id: true } });
      if (!request) throw new RefundEvidenceError("Refund request not found.", 404);
      return NextResponse.json(await listBuyerRefundEvidence(prisma, session.userId, request.id));
    }
    const request = await prisma.refundRequest.findFirst({ where: { orderId }, select: { id: true } });
    if (!request) throw new RefundEvidenceError("Refund request not found.", 404);
    await getSellerRefundRequest(prisma, session.userId, request.id);
    return NextResponse.json(await listSellerRefundEvidence(prisma, session.userId, orderId, request.id));
  } catch (error) {
    return errorResponse(error, "Unable to load refund evidence.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session || session.role !== "CUSTOMER") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { orderId } = await context.params;
  try {
    const refund = await prisma.refundRequest.findFirst({ where: { orderId, buyerId: session.userId, order: { buyerId: session.userId } }, select: { id: true } });
    if (!refund) throw new RefundEvidenceError("Refund request not found.", 404);
    const file = await parseEvidenceMultipart(request);
    return NextResponse.json(await uploadBuyerRefundEvidence(prisma, r2ObjectStore(), session.userId, refund.id, file), { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to upload refund evidence.");
  }
}
export const runtime = "nodejs";
