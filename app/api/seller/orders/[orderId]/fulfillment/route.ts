import { NextResponse } from "next/server";
import { advanceSellerFulfillment, FulfillmentError, type SellerFulfillmentAction } from "@/lib/fulfillment";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { orderId } = await context.params;
    const body = await request.json() as { action?: SellerFulfillmentAction; trackingCarrier?: unknown; trackingNumber?: unknown };
    const result = await advanceSellerFulfillment(prisma, session.userId, orderId, body.action as SellerFulfillmentAction, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof FulfillmentError ? error.message : "Unable to update fulfillment." }, { status: error instanceof FulfillmentError ? error.status : 500 });
  }
}
