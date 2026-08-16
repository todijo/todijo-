import { NextResponse } from "next/server";
import { decideSellerRefundRequest, getSellerRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { requestId } = await context.params;
  try {
    return NextResponse.json(await getSellerRefundRequest(prisma, session.userId, requestId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to load refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if(session.sellerSuspended&&session.role!=="ADMIN")return NextResponse.json({error:"SELLER_SUSPENDED"},{status:403});
  const { requestId } = await context.params;
  let body: { decision?: unknown; decisionNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    return NextResponse.json(await decideSellerRefundRequest(prisma, session.userId, requestId, body?.decision, { decisionNote: body?.decisionNote }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to decide refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}
