import { NextResponse } from "next/server";
import { decideAdminRefundRequest, getAdminRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { ensureRefundOperation, processRefundOperation } from "@/lib/refund-lifecycle";

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
  let body: { decision?: unknown; decisionNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const decision = await decideAdminRefundRequest(prisma, session, requestId, body?.decision, { decisionNote: body?.decisionNote });
    if (body.decision !== "approve") return NextResponse.json(decision);
    const operation = await ensureRefundOperation(prisma, requestId, session.userId);
    const financial = await processRefundOperation(prisma, operation.id);
    return NextResponse.json({ ...decision, refundOperationId: operation.id, financial });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to decide refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}
