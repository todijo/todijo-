import { NextResponse } from "next/server";
import { decideAdminRefundRequest, getAdminRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertRefundRequestPaymentMode, ensureRefundOperation, processRefundOperation, RefundPaymentModeError } from "@/lib/refund-lifecycle";

export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { requestId } = await context.params;
  try {
    return NextResponse.json(await getAdminRefundRequest(prisma, session, requestId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to load refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { requestId } = await context.params;
  let body: { decision?: unknown; decisionNote?: unknown; returnRequired?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    if (body.decision === "approve") await assertRefundRequestPaymentMode(prisma, requestId);
    const decision = await decideAdminRefundRequest(prisma, session, requestId, body?.decision, { decisionNote: body?.decisionNote });
    if (body.decision !== "approve") return NextResponse.json(decision);
    if (body.returnRequired != null && typeof body.returnRequired !== "boolean") return NextResponse.json({ error: "Invalid return requirement." }, { status: 400 });
    const operation = await ensureRefundOperation(prisma, requestId, session.userId, { returnRequired: body.returnRequired === true });
    const financial = await processRefundOperation(prisma, operation.id);
    return NextResponse.json({ ...decision, refundOperationId: operation.id, financial });
  } catch (error) {
    const requestRecord = await prisma.refundRequest.findUnique({ where: { id: requestId }, select: { orderId: true, refundOperation: { select: { id: true } } } }).catch(() => null);
    const code = error instanceof RefundPaymentModeError ? error.code : error instanceof RefundRequestError ? "REFUND_REQUEST_INVALID" : "REFUND_FINANCIAL_PROCESSING_FAILED";
    console.error("[admin-refund]", JSON.stringify({ refundRequestId: requestId, orderId: requestRecord?.orderId ?? null, refundOperationId: requestRecord?.refundOperation?.id ?? null, stage: error instanceof RefundPaymentModeError ? "payment_mode_validation" : "admin_decision_or_financial_processing", expectedStripeMode: error instanceof RefundPaymentModeError ? error.expectedMode : null, actualPaymentMode: error instanceof RefundPaymentModeError ? error.actualMode : null, code }));
    return NextResponse.json({ code, error: error instanceof RefundPaymentModeError ? error.message : error instanceof RefundRequestError ? error.message : "Unable to decide refund request." }, { status: error instanceof RefundPaymentModeError ? error.status : error instanceof RefundRequestError ? error.status : 500 });
  }
}
