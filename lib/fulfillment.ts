import { Prisma, type PrismaClient } from "@prisma/client";
import { markSellerGroupsShipmentVerified } from "./seller-transfers";
import {safeCarrierTrackingUrl} from "./tracking";
import { requireStoreCapability, SellerCapabilityError } from "./seller-business-access";
import { appendSellerBusinessAudit } from "./seller-business-audit";

export const fulfillmentTransitions = {
  PAID: { nextOrderStatus: "PROCESSING", nextFulfillmentStatus: "PROCESSING", timestamp: "processingAt" },
  PROCESSING: { nextOrderStatus: "SHIPPED", nextFulfillmentStatus: "SHIPPED", timestamp: "shippedAt" },
  SHIPPED: { nextOrderStatus: "DELIVERED", nextFulfillmentStatus: "DELIVERED", timestamp: "deliveredAt" },
} as const;

export type SellerFulfillmentAction = keyof typeof fulfillmentTransitions;

export class FulfillmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function normalizedTracking(value: unknown, limit: number) {
  if (value == null) return null;
  if (typeof value !== "string") throw new FulfillmentError("Invalid tracking value.");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.length > limit || /[\u0000-\u001f\u007f]/.test(normalized)) throw new FulfillmentError("Invalid tracking value.");
  return normalized;
}

export async function advanceSellerFulfillment(db: PrismaClient, sellerId: string, orderId: string, action: SellerFulfillmentAction, input: { trackingCarrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown } = {}) {
  const transition = fulfillmentTransitions[action];
  if (!transition) throw new FulfillmentError("Invalid fulfillment transition.");
  const carrier = normalizedTracking(input.trackingCarrier, 120);
  const number = normalizedTracking(input.trackingNumber, 160);
  const urlText = normalizedTracking(input.trackingUrl, 500);
  if(urlText)throw new FulfillmentError("Custom tracking URLs are not accepted.");
  const trackingUrl=safeCarrierTrackingUrl(carrier,number);
  if (action !== "PROCESSING" && (carrier || number || trackingUrl)) throw new FulfillmentError("Tracking can only be set when shipping an order.");

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true,storeIdSnapshot:true,status: true,paidAt:true,stripePaymentIntentId:true, fulfillmentStatus: true, processingAt: true, shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true, trackingUrl: true,items:{select:{product:{select:{storeId:true}}}} },
    });
    if (!order) throw new FulfillmentError("Order not found.", 404);
    const storeIds=[...new Set(order.storeIdSnapshot?[order.storeIdSnapshot]:order.items.map(item=>item.product.storeId))];
    let principal;try{for(const storeId of storeIds){const authorized=await requireStoreCapability(tx,sellerId,storeId,"ORDER_FULFILL");principal??=authorized}}catch(error){if(error instanceof SellerCapabilityError)throw new FulfillmentError("Order not found.",404);throw error}
    if(!order.paidAt&&!order.stripePaymentIntentId)throw new FulfillmentError("Paid order required.",409);
    if (order.status === transition.nextOrderStatus) {
      const verifiedGroups = transition.nextOrderStatus === "SHIPPED" ? await markSellerGroupsShipmentVerified(tx, order.id, storeIds) : [];
      return { idempotent: true, status: order.status, verifiedSellerGroups: verifiedGroups.length };
    }
    if (order.status !== action) throw new FulfillmentError("Invalid fulfillment transition.", 409);
    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: transition.nextOrderStatus, fulfillmentStatus: transition.nextFulfillmentStatus, [transition.timestamp]: now };
    if (action === "PROCESSING") Object.assign(data, { trackingCarrier: carrier ?? order.trackingCarrier, trackingNumber: number ?? order.trackingNumber, trackingUrl: trackingUrl ?? order.trackingUrl });
    const updated = await tx.order.update({ where: { id: order.id }, data, select: { id: true, status: true, fulfillmentStatus: true, processingAt: true, shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true, trackingUrl: true } });
    await tx.orderFulfillmentEvent.create({ data: { orderId: order.id, status: transition.nextFulfillmentStatus, source: "SELLER", actorId: sellerId, occurredAt: now, metadata: action === "PROCESSING" && (carrier || number || trackingUrl) ? { trackingCarrier: carrier, trackingNumber: number, trackingUrl } : undefined } });
    await tx.orderLifecycleEvent.create({ data: { orderId: order.id, type: transition.nextOrderStatus, actorId: sellerId, createdAt: now, metadata: action === "PROCESSING" && (carrier || number) ? { trackingCarrier: carrier, trackingNumber: number } : undefined } });
    await appendSellerBusinessAudit(tx,{businessId:principal!.businessId,storeId:storeIds.length===1?storeIds[0]:undefined,actorId:sellerId,category:"ORDER",action:`FULFILLMENT_${transition.nextOrderStatus}`,targetType:"Order",targetId:order.id,metadata:{storeIds}});
    const verifiedGroups = transition.nextOrderStatus === "SHIPPED" ? await markSellerGroupsShipmentVerified(tx, order.id, storeIds, now) : [];
    if (transition.nextOrderStatus === "SHIPPED" || transition.nextOrderStatus === "DELIVERED") {
      await tx.notification.create({ data: { userId: order.buyerId, type: `ORDER_${transition.nextOrderStatus}`, title: transition.nextOrderStatus === "SHIPPED" ? "Order shipped" : "Order delivered", body: transition.nextOrderStatus === "SHIPPED" ? "Your order has been shipped." : "Your order has been delivered.", href: `/account/orders/${order.id}` } });
    }
    return { idempotent: false, order: updated, verifiedSellerGroups: verifiedGroups.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
