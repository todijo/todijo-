import { NextResponse } from "next/server";
import { createBuyerRefundRequest, getBuyerRefundRequest, RefundRequestError } from "@/lib/refund-requests";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { orderId } = await context.params;
  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const result = await createBuyerRefundRequest(prisma, session.userId, orderId, { reason: body?.reason });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to create refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { orderId } = await context.params;
  try {
    return NextResponse.json(await getBuyerRefundRequest(prisma, session.userId, orderId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefundRequestError ? error.message : "Unable to load refund request." }, { status: error instanceof RefundRequestError ? error.status : 500 });
  }
}
