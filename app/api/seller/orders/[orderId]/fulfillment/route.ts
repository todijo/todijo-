import { NextResponse } from "next/server";
import { advanceSellerFulfillment, FulfillmentError, type SellerFulfillmentAction } from "@/lib/fulfillment";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { dispatchNotificationPushBestEffort } from "@/lib/web-push-delivery";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if(session.sellerSuspended&&session.role!=="ADMIN")return NextResponse.json({error:"SELLER_SUSPENDED"},{status:403});
  try {
    const { orderId } = await context.params;
    const body = await request.json() as { action?: SellerFulfillmentAction; trackingCarrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown };
    const result = await advanceSellerFulfillment(prisma, session.userId, orderId, body.action as SellerFulfillmentAction, body);
    if(!result.idempotent&&["PROCESSING","SHIPPED"].includes(body.action??"")){const type=body.action==="PROCESSING"?"ORDER_SHIPPED":"ORDER_DELIVERED",notification=await prisma.notification.findFirst({where:{userId:{not:session.userId},type,href:`/account/orders/${orderId}`},orderBy:{createdAt:"desc"},select:{id:true}});if(notification)dispatchNotificationPushBestEffort(notification.id);}
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof FulfillmentError ? error.message : "Unable to update fulfillment." }, { status: error instanceof FulfillmentError ? error.status : 500 });
  }
}
