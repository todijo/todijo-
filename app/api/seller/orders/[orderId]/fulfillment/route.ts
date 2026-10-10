import { NextResponse } from "next/server";
import { advanceSellerFulfillment, FulfillmentError, type SellerFulfillmentAction } from "@/lib/fulfillment";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if(session.sellerSuspended&&session.role!=="ADMIN")return NextResponse.json({error:"SELLER_SUSPENDED"},{status:403});
  try {
    const { orderId } = await context.params;
    const body = await request.json() as { action?: SellerFulfillmentAction; trackingCarrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown };
    if (body.action === "PROCESSING" || body.action === "SHIPPED") return NextResponse.json({ error: "ITEM_LEVEL_SHIPMENT_REQUIRED" }, { status: 409 });
    const result = await advanceSellerFulfillment(prisma, session.userId, orderId, body.action as SellerFulfillmentAction, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof FulfillmentError ? error.message : "Unable to update fulfillment." }, { status: error instanceof FulfillmentError ? error.status : 500 });
  }
}
