import { NextResponse } from "next/server";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { getSellerRefundEvidence, RefundEvidenceError } from "@/lib/refund-evidence";
import { refundEvidenceContentDisposition } from "@/lib/refund-evidence-headers";
import { prisma } from "@/lib/prisma";
import { r2ObjectStore } from "@/lib/r2";

export async function GET(request: Request, context: { params: Promise<{ orderId: string; evidenceId: string }> }) {
  try {
    const { userId } = await requireMobileSeller(request);
    const { orderId, evidenceId } = await context.params;
    const evidence = await getSellerRefundEvidence(prisma, userId, orderId, evidenceId);
    const body = await (await r2ObjectStore().get(evidence.storageKey)).arrayBuffer();
    return new NextResponse(body, { headers: {
      "Content-Type": evidence.mimeType,
      "Content-Disposition": refundEvidenceContentDisposition(evidence.originalFilename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof RefundEvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
