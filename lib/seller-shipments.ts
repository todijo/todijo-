import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { requireStoreCapability, SellerCapabilityError } from "./seller-business-access";
import { markSellerGroupsShipmentVerified } from "./seller-transfers";
import { safeCarrierTrackingUrl } from "./tracking";
import { enqueueBuyerShipmentEmail } from "./buyer-order-email-deliveries";

type ShipmentLineInput = { orderItemId: unknown; quantity: unknown };
export class SellerShipmentError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
function boundedText(value: unknown, max: number, field: string) {
  if (value == null) return null;
  if (typeof value !== "string") throw new SellerShipmentError(`Invalid ${field}.`);
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new SellerShipmentError(`Invalid ${field}.`);
  return text;
}
function normalizedLines(input: unknown): Array<{ orderItemId: string; quantity: number }> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) throw new SellerShipmentError("At least one item is required.");
  const seen = new Set<string>();
  return input.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SellerShipmentError("Invalid shipment item.");
    const line = raw as ShipmentLineInput;
    if (typeof line.orderItemId !== "string" || !line.orderItemId.trim() || line.orderItemId.length > 128 || seen.has(line.orderItemId)) throw new SellerShipmentError("Invalid shipment item.");
    if (!Number.isSafeInteger(line.quantity) || Number(line.quantity) < 1) throw new SellerShipmentError("Invalid shipment quantity.");
    seen.add(line.orderItemId);
    return { orderItemId: line.orderItemId, quantity: Number(line.quantity) };
  }).sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));
}
function payloadMatches(existing: Array<{ orderItemId: string; quantity: number }>, input: Array<{ orderItemId: string; quantity: number }>) {
  return existing.length === input.length && existing.every((line, index) => line.orderItemId === input[index]?.orderItemId && line.quantity === input[index]?.quantity);
}
const activeRefundStatuses = ["REQUESTED", "APPROVED", "PROCESSING", "PARTIALLY_COMPLETED", "COMPLETED", "RETRYABLE", "MANUAL_ACTION_REQUIRED"] as const;
function refundedQuantity(item: { refundAllocations: Array<{ quantity: number; refundOperation: { status: string } }> }) {
  return item.refundAllocations.filter((allocation) => activeRefundStatuses.includes(allocation.refundOperation.status as typeof activeRefundStatuses[number])).reduce((sum, allocation) => sum + allocation.quantity, 0);
}
function completedRefundQuantity(item: { refundAllocations: Array<{ quantity: number; refundOperation: { status: string } }> }) {
  return item.refundAllocations.filter((allocation) => allocation.refundOperation.status === "COMPLETED").reduce((sum, allocation) => sum + allocation.quantity, 0);
}
export function remainingShipmentQuantity(ordered: number, shipped: number, heldForRefund: number) {
  return Math.max(0, ordered - shipped - heldForRefund);
}
function retryableShipmentConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

/** Store-scoped, item-level shipment report. A report is seller-provided information, not carrier confirmation. */
export async function recordSellerShipment(db: PrismaClient, actorId: string, orderId: string, storeId: string, input: { idempotencyKey: unknown; items: unknown; carrier?: unknown; trackingNumber?: unknown }) {
  const idempotencyKey = input.idempotencyKey;
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{12,120}$/.test(idempotencyKey)) throw new SellerShipmentError("Invalid shipment request key.");
  const lines = normalizedLines(input.items);
  const carrier = boundedText(input.carrier, 120, "carrier");
  const trackingNumber = boundedText(input.trackingNumber, 160, "tracking number");
  const trackingUrl = safeCarrierTrackingUrl(carrier, trackingNumber);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
    let group = await tx.orderGroup.findUnique({
      where: { orderId_groupKey: { orderId, groupKey: `store:${storeId}` } },
      select: { id: true, orderId: true, storeId: true, kind: true, store: { select: { id: true, name: true } } },
    });
    if (!group || group.storeId !== storeId || group.kind !== "MARKETPLACE" || !group.store) throw new SellerShipmentError("Order not found.", 404);
    let principal;
    try { principal = await requireStoreCapability(tx, actorId, storeId, "ORDER_FULFILL"); }
    catch (error) { if (error instanceof SellerCapabilityError) throw new SellerShipmentError("Order not found.", 404); throw error; }

    // Serialize shipment quantity allocation for this seller group.
    await tx.$queryRaw`SELECT "id" FROM "OrderGroup" WHERE "id" = ${group.id} FOR UPDATE`;
    const existing = await tx.shipment.findUnique({ where: { orderGroupId_idempotencyKey: { orderGroupId: group.id, idempotencyKey } }, include: { items: { select: { orderItemId: true, quantity: true } } } });
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, status: true, paidAt: true, stripePaymentIntentId: true, fulfillmentStatus: true,
        groups: { select: { id: true, kind: true, shipments: { where: { status: { not: "CANCELLED" } }, select: { items: { select: { orderItemId: true, quantity: true } } } }, items: { select: { id: true, quantity: true, orderGroupId: true, productNameSnapshot: true, product: { select: { name: true } }, refundAllocations: { select: { quantity: true, refundOperation: { select: { status: true } } } }, supplierFulfillmentItem: { select: { fulfillment: { select: { status: true } } } } } } } },
      },
    });
    if (!order) throw new SellerShipmentError("Order not found.", 404);
    if (existing) {
      if (!payloadMatches(existing.items, lines)) throw new SellerShipmentError("Shipment request key was already used for different quantities.", 409);
      return { idempotent: true, shipmentId: existing.id, fulfillmentStatus: order.fulfillmentStatus, orderComplete: order.status === "SHIPPED" };
    }
    group = await tx.orderGroup.findUnique({ where: { id: group.id }, select: { id: true, orderId: true, storeId: true, kind: true, store: { select: { id: true, name: true } } } });
    if (!group || group.storeId !== storeId || group.kind !== "MARKETPLACE" || !group.store) throw new SellerShipmentError("Order not found.", 404);
    if (!["PAID", "PROCESSING", "SHIPPED"].includes(order.status) || (!order.paidAt && !order.stripePaymentIntentId)) throw new SellerShipmentError("A confirmed payment is required before shipping.", 409);

    const groupItems = order.groups.find((row) => row.id === group!.id)?.items ?? [];
    if (!groupItems.length) throw new SellerShipmentError("Order items are unavailable for shipment.", 409);
    const previousShipments = order.groups.flatMap((row) => row.shipments).flatMap((shipment) => shipment.items);
    const remaining = new Map(groupItems.map((item) => {
      const shipped = previousShipments.filter((row) => row.orderItemId === item.id).reduce((sum, row) => sum + row.quantity, 0);
      return [item.id, remainingShipmentQuantity(item.quantity, shipped, refundedQuantity(item))] as const;
    }));
    for (const line of lines) {
      const available = remaining.get(line.orderItemId);
      if (available == null || line.quantity > available) throw new SellerShipmentError("Shipment quantity exceeds the remaining quantity.", 409);
    }

    const shipment = await tx.shipment.create({ data: { orderId, orderGroupId: group.id, storeId, createdById: actorId, idempotencyKey, carrier, trackingNumber, trackingUrl, status: "SELLER_REPORTED", items: { create: lines.map((line) => ({ orderItem: { connect: { id_orderGroupId: { id: line.orderItemId, orderGroupId: group!.id } } }, quantity: line.quantity })) } }, include: { items: { select: { orderItemId: true, quantity: true } } } });
    const now = new Date();
    await tx.orderGroup.updateMany({ where: { id: group.id, sellerDispatchReportedAt: null }, data: { sellerDispatchReportedAt: now } });
    await tx.orderLifecycleEvent.create({ data: { orderId, type: "SELLER_SHIPMENT_REPORTED", actorId, createdAt: now, metadata: { shipmentId: shipment.id, storeId, itemCount: lines.length } } });
    await appendSellerBusinessAudit(tx, { businessId: principal.businessId, storeId, actorId, category: "ORDER", action: "SHIPMENT_REPORTED", targetType: "Shipment", targetId: shipment.id, metadata: { orderId, itemCount: lines.length } });

    const newShipmentQuantity = (itemId: string) => lines.filter((line) => line.orderItemId === itemId).reduce((sum, line) => sum + line.quantity, 0);
    const groupComplete = groupItems.every((item) => {
      const already = previousShipments.filter((row) => row.orderItemId === item.id).reduce((sum, row) => sum + row.quantity, 0);
      return already + newShipmentQuantity(item.id) + completedRefundQuantity(item) >= item.quantity;
    });
    if (groupComplete) await markSellerGroupsShipmentVerified(tx, orderId, [storeId], now);

    const allShipped = order.groups.every((row) => row.items.every((item) => {
      if (row.kind === "MARKETPLACE") {
        const shippedQty = previousShipments.filter((shipmentItem) => shipmentItem.orderItemId === item.id).reduce((sum, shipmentItem) => sum + shipmentItem.quantity, 0) + newShipmentQuantity(item.id);
        return shippedQty >= item.quantity;
      }
      const supplierStatus = item.supplierFulfillmentItem?.fulfillment.status;
      return supplierStatus === "SHIPPED" || supplierStatus === "DELIVERED";
    }));
    const nextStatus = allShipped ? "SHIPPED" : "PARTIALLY_SHIPPED";
    await tx.order.update({ where: { id: orderId }, data: { status: allShipped ? "SHIPPED" : order.status === "PAID" ? "PROCESSING" : order.status, fulfillmentStatus: nextStatus, ...(allShipped ? { shippedAt: now } : {}) } });
    await tx.orderFulfillmentEvent.create({ data: { orderId, status: nextStatus, source: "SELLER", actorId, occurredAt: now, metadata: { shipmentId: shipment.id, storeId } } });
    const items = lines.map((line) => {
      const item = groupItems.find((row) => row.id === line.orderItemId)!;
      return { name: item.productNameSnapshot ?? item.product.name, quantity: line.quantity };
    });
    const marketplaceGroups = order.groups.filter((row) => row.kind === "MARKETPLACE").length;
    const fullyShippedSingleStoreOrder = allShipped && marketplaceGroups === 1 && order.groups.every((row) => row.kind === "MARKETPLACE");
    await enqueueBuyerShipmentEmail(tx, { orderId, shipmentId: shipment.id, storeName: group.store.name, items, kind: fullyShippedSingleStoreOrder ? "ORDER_SHIPPED" : "SHIPMENT_RECORDED" });
    if (allShipped) await tx.notification.create({ data: { userId: order.buyerId, type: "ORDER_SHIPPED", title: "Order shipped", body: "Your order has been shipped.", href: `/account/orders/${orderId}` } });
    return { idempotent: false, shipmentId: shipment.id, fulfillmentStatus: nextStatus, orderComplete: allShipped };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // Re-read under a fresh transaction after a duplicate-key/serialization race. The
      // durable unique request key then returns the original shipment or rejects payload drift.
      if (attempt >= 2 || !retryableShipmentConflict(error)) throw error;
    }
  }
}
