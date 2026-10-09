import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { dispatchBuyerOrderEmailDeliveriesBestEffort } from "@/lib/buyer-order-email-deliveries";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { SellerShipmentError, recordSellerShipment } from "@/lib/seller-shipments";
import { dispatchNotificationPushBestEffort } from "@/lib/web-push-delivery";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (session.sellerSuspended && session.role !== "ADMIN") return NextResponse.json({ error: "SELLER_SUSPENDED" }, { status: 403 });
  try {
    const { orderId } = await context.params;
    const body = await request.json() as { storeId?: unknown; idempotencyKey?: unknown; items?: unknown; carrier?: unknown; trackingNumber?: unknown };
    if (typeof body.storeId !== "string" || !body.storeId.trim()) return NextResponse.json({ error: "STORE_REQUIRED" }, { status: 400 });
    const result = await recordSellerShipment(prisma, session.userId, orderId, body.storeId, { idempotencyKey: body.idempotencyKey, items: body.items, carrier: body.carrier, trackingNumber: body.trackingNumber });
    if (!result.idempotent) dispatchBuyerOrderEmailDeliveriesBestEffort(orderId);
    if (result.orderComplete && !result.idempotent) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { buyerId: true } });
      if (order) {
        const notification = await prisma.notification.findFirst({ where: { userId: order.buyerId, type: "ORDER_SHIPPED", href: `/account/orders/${orderId}` }, orderBy: { createdAt: "desc" }, select: { id: true } });
        if (notification) dispatchNotificationPushBestEffort(notification.id);
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SellerShipmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (process.env.TODIJO_E2E_DIAGNOSTICS === "1") {
      return NextResponse.json({ error: "Unable to record shipment.", diagnostic: {
        name: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        ...(error instanceof Prisma.PrismaClientKnownRequestError ? { code: error.code, target: error.meta?.target } : {}),
        ...(error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError) ? { message: error.message.slice(-2000) } : {}),
      } }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to record shipment." }, { status: 500 });
  }
}
