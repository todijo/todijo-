import { NextResponse } from "next/server";
import { getBuyerRefundEvidence, RefundEvidenceError } from "@/lib/refund-evidence";
import { refundEvidenceContentDisposition } from "@/lib/refund-evidence-headers";
import { prisma } from "@/lib/prisma";
import { r2ObjectStore } from "@/lib/r2";
import { readSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string; evidenceId: string }> }) {
  const session = await readSession();
  if (!session || session.role !== "CUSTOMER") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { orderId, evidenceId } = await context.params;
  try {
    const refund = await prisma.refundRequest.findFirst({ where: { orderId, buyerId: session.userId, order: { buyerId: session.userId } }, select: { id: true } });
    if (!refund) throw new RefundEvidenceError("Refund request not found.", 404);
    const evidence = await getBuyerRefundEvidence(prisma, session.userId, refund.id, evidenceId);
    const response = await r2ObjectStore().get(evidence.storageKey);
    const body = await response.arrayBuffer();
    return new NextResponse(body, { headers: { "Content-Type": evidence.mimeType, "Content-Disposition": refundEvidenceContentDisposition(evidence.originalFilename), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundEvidenceError ? error.message : "Unable to load refund evidence." }, { status: error instanceof RefundEvidenceError ? error.status : 500 });
  }
}
