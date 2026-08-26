import { Prisma, type PrismaClient } from "@prisma/client";
import { isAdminRole } from "./admin-access";

export type RestockDecision = "PRE_SHIPMENT_CANCELLATION" | "RETURN_SELLABLE" | "RETURN_NON_SELLABLE" | "RETURN_PENDING";
export function restockState(input: { isSupplierOwned: boolean; shipmentVerified: boolean; decision: RestockDecision }) {
  if (input.isSupplierOwned) return { status: "NOT_APPLICABLE" as const, restore: false };
  if (input.decision === "RETURN_NON_SELLABLE") return { status: "NON_RESTOCKABLE" as const, restore: false };
  if (input.decision === "RETURN_PENDING") return { status: input.shipmentVerified ? "AWAITING_RETURN" as const : "NOT_APPLICABLE" as const, restore: false };
  if (input.decision === "PRE_SHIPMENT_CANCELLATION") return input.shipmentVerified ? { status: "AWAITING_RETURN" as const, restore: false } : { status: "RESTOCKED" as const, restore: true };
  return input.shipmentVerified ? { status: "RESTOCKABLE" as const, restore: false } : { status: "INSPECTION_REQUIRED" as const, restore: false };
}

export async function applyInventoryRestock(db: PrismaClient, input: { refundOperationId: string; orderItemId: string; quantity: number; decision: RestockDecision; actorId?: string; idempotencyKey: string }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("INVALID_RESTOCK_QUANTITY");
  return db.$transaction(async tx => {
    const existing = await tx.inventoryRestockEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: input.orderItemId }, select: { quantity: true, variantId: true, productId: true, orderGroup: { select: { shipmentVerifiedAt: true, kind: true } }, restockEvents: { where: { status: "RESTOCKED" }, select: { quantity: true } } } });
    const alreadyRestored = item.restockEvents.reduce((sum, event) => sum + event.quantity, 0);
    if (input.quantity > item.quantity - alreadyRestored) throw new Error("RESTOCK_EXCEEDS_PURCHASED_QUANTITY");
    const state = restockState({ isSupplierOwned: item.orderGroup?.kind === "CJ_PLATFORM", shipmentVerified: Boolean(item.orderGroup?.shipmentVerifiedAt), decision: input.decision });
    const event = await tx.inventoryRestockEvent.create({ data: { refundOperationId: input.refundOperationId, orderItemId: input.orderItemId, quantity: input.quantity, status: state.status, reason: input.decision, idempotencyKey: input.idempotencyKey, decidedById: input.actorId, decidedAt: input.actorId ? new Date() : null, restoredAt: state.restore ? new Date() : null } });
    if (state.restore) {
      if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: input.quantity } } });
      else await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: input.quantity } } });
    }
    return event;
  }, { isolationLevel: "Serializable" });
}

export type ReturnAction = "tracking" | "receive" | "restockable" | "non_restockable" | "restock";
type ReturnInput = { carrier?: unknown; trackingNumber?: unknown; reason?: unknown };

type ReturnRecordIdentity = {
  lifecycleKey: string | null;
  refundOperationId: string;
  orderItemId: string;
  refundOperation: { status: string };
  orderItem: { orderGroup: { kind: string } | null };
};

/** Only Stage 4 records created for a completed Marketplace refund are actionable returns. */
export function isAuthoritativeStage4Return(event: ReturnRecordIdentity) {
  return event.lifecycleKey === `return:${event.refundOperationId}:${event.orderItemId}`
    && event.refundOperation.status === "COMPLETED"
    && event.orderItem.orderGroup?.kind === "MARKETPLACE";
}

function text(value: unknown, max: number) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("INVALID_RETURN_INPUT");
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error("INVALID_RETURN_INPUT");
  return normalized;
}

async function authorizeReturnActor(tx: Prisma.TransactionClient, actorId: string, eventId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (!actor) throw new Error("RETURN_NOT_FOUND");
  const event = await tx.inventoryRestockEvent.findUnique({ where: { id: eventId }, include: { refundOperation: { select: { orderId: true, status: true } }, orderItem: { select: { id: true, quantity: true, variantId: true, productId: true, orderGroup: { select: { id: true, kind: true, store: { select: { ownerId: true } } } } } } } });
  if (!event || !event.orderItem.orderGroup || !isAuthoritativeStage4Return(event)) throw new Error("RETURN_NOT_FOUND");
  if (!isAdminRole(actor.role) && event.orderItem.orderGroup.store?.ownerId !== actorId) throw new Error("RETURN_NOT_FOUND");
  return event;
}

/** Server-authoritative physical return state machine. It never invokes refund or payout code. */
export async function transitionReturnCase(db: PrismaClient, actorId: string, eventId: string, action: ReturnAction, input: ReturnInput = {}, now = new Date()) {
  return db.$transaction(async (tx) => {
    const event = await authorizeReturnActor(tx, actorId, eventId);
    if (event.status === "NOT_APPLICABLE" || event.status === "NON_RESTOCKABLE") return event;
    let data: Prisma.InventoryRestockEventUpdateManyMutationInput;
    let expected: typeof event.status[];
    if (action === "tracking") {
      data = { trackingCarrier: text(input.carrier, 120), trackingNumber: text(input.trackingNumber, 200), trackingSubmittedAt: now };
      expected = ["AWAITING_RETURN"];
    } else if (action === "receive") {
      data = { status: "INSPECTION_REQUIRED", receivedAt: now, reason: "RETURN_RECEIVED" };
      expected = ["AWAITING_RETURN", "RETURN_RECEIVED"];
    } else if (action === "restockable") {
      data = { status: "RESTOCKABLE", inspectedAt: now, inspectionReason: text(input.reason, 500), reason: "RETURN_SELLABLE", decidedById: actorId, decidedAt: now };
      expected = ["INSPECTION_REQUIRED"];
    } else if (action === "non_restockable") {
      data = { status: "NON_RESTOCKABLE", inspectedAt: now, inspectionReason: text(input.reason, 500), reason: "RETURN_NON_SELLABLE", decidedById: actorId, decidedAt: now };
      expected = ["INSPECTION_REQUIRED"];
    } else {
      if (event.status === "RESTOCKED") return event;
      data = { status: "RESTOCKED", restoredAt: now, decidedById: actorId, decidedAt: now };
      expected = ["RESTOCKABLE"];
    }
    const changed = await tx.inventoryRestockEvent.updateMany({ where: { id: event.id, status: { in: expected } }, data });
    if (changed.count !== 1) return tx.inventoryRestockEvent.findUniqueOrThrow({ where: { id: event.id } });

    let inventoryBefore: number | null = null;
    if (action === "restock") {
      const restored = await tx.inventoryRestockEvent.aggregate({ where: { orderItemId: event.orderItemId, id: { not: event.id }, status: "RESTOCKED" }, _sum: { quantity: true } });
      if ((restored._sum.quantity ?? 0) + event.quantity > event.orderItem.quantity) throw new Error("RESTOCK_EXCEEDS_PURCHASED_QUANTITY");
      if (event.orderItem.variantId) {
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: event.orderItem.variantId }, select: { stock: true, productId: true } });
        if (variant.productId !== event.orderItem.productId) throw new Error("RETURN_INVENTORY_MISMATCH");
        inventoryBefore = variant.stock;
        await tx.productVariant.update({ where: { id: event.orderItem.variantId }, data: { stock: { increment: event.quantity } } });
      } else {
        const product = await tx.product.findUniqueOrThrow({ where: { id: event.orderItem.productId }, select: { stock: true } });
        inventoryBefore = product.stock;
        await tx.product.update({ where: { id: event.orderItem.productId }, data: { stock: { increment: event.quantity } } });
      }
      await tx.inventoryRestockEvent.update({ where: { id: event.id }, data: { inventoryBefore, inventoryAfter: inventoryBefore + event.quantity } });
    }
    await tx.orderLifecycleEvent.create({ data: { orderId: event.refundOperation.orderId, type: `RETURN_${action.toUpperCase()}`, actorId, createdAt: now, metadata: { inventoryRestockEventId: event.id, orderItemId: event.orderItemId, orderGroupId: event.orderItem.orderGroup!.id, quantity: event.quantity, fromStatus: event.status, action } } });
    return tx.inventoryRestockEvent.findUniqueOrThrow({ where: { id: event.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
