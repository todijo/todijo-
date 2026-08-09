import { Prisma, type PrismaClient } from "@prisma/client";

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

export async function advanceSellerFulfillment(db: PrismaClient, sellerId: string, orderId: string, action: SellerFulfillmentAction, input: { trackingCarrier?: unknown; trackingNumber?: unknown } = {}) {
  const transition = fulfillmentTransitions[action];
  if (!transition) throw new FulfillmentError("Invalid fulfillment transition.");
  const carrier = normalizedTracking(input.trackingCarrier, 120);
  const number = normalizedTracking(input.trackingNumber, 160);
  if (action !== "PROCESSING" && (carrier || number)) throw new FulfillmentError("Tracking can only be set when shipping an order.");

  return db.$transaction(async (tx) => {
    const stores = await tx.store.findMany({ where: { ownerId: sellerId }, select: { id: true } });
    const storeIds = stores.map((store) => store.id);
    const order = await tx.order.findFirst({ where: { id: orderId, OR: [{ storeIdSnapshot: { in: storeIds } }, { storeIdSnapshot: null, items: { some: { product: { store: { ownerId: sellerId } } } } }] }, select: { id: true, status: true, fulfillmentStatus: true, processingAt: true, shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true } });
    if (!order) throw new FulfillmentError("Order not found.", 404);
    if (order.status === transition.nextOrderStatus) return { idempotent: true, status: order.status };
    if (order.status !== action) throw new FulfillmentError("Invalid fulfillment transition.", 409);
    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: transition.nextOrderStatus, fulfillmentStatus: transition.nextFulfillmentStatus, [transition.timestamp]: now };
    if (action === "PROCESSING") Object.assign(data, { trackingCarrier: carrier ?? order.trackingCarrier, trackingNumber: number ?? order.trackingNumber });
    const updated = await tx.order.update({ where: { id: order.id }, data, select: { id: true, status: true, fulfillmentStatus: true, processingAt: true, shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true } });
    await tx.orderFulfillmentEvent.create({ data: { orderId: order.id, status: transition.nextFulfillmentStatus, source: "SELLER", actorId: sellerId, occurredAt: now, metadata: action === "PROCESSING" && (carrier || number) ? { trackingCarrier: carrier, trackingNumber: number } : undefined } });
    await tx.orderLifecycleEvent.create({ data: { orderId: order.id, type: transition.nextOrderStatus, actorId: sellerId, createdAt: now, metadata: action === "PROCESSING" && (carrier || number) ? { trackingCarrier: carrier, trackingNumber: number } : undefined } });
    return { idempotent: false, order: updated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
