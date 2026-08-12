import type { PrismaClient } from "@prisma/client";

export type RestockDecision = "PRE_SHIPMENT_CANCELLATION" | "RETURN_SELLABLE" | "RETURN_NON_SELLABLE" | "RETURN_PENDING";
export function restockState(input: { isSupplierOwned: boolean; shipmentVerified: boolean; decision: RestockDecision }) {
  if (input.isSupplierOwned) return { status: "NOT_APPLICABLE" as const, restore: false };
  if (input.decision === "RETURN_NON_SELLABLE") return { status: "NON_RESTOCKABLE" as const, restore: false };
  if (input.decision === "RETURN_PENDING") return { status: input.shipmentVerified ? "AWAITING_RETURN" as const : "NOT_APPLICABLE" as const, restore: false };
  if (input.decision === "PRE_SHIPMENT_CANCELLATION") return input.shipmentVerified ? { status: "AWAITING_RETURN" as const, restore: false } : { status: "RESTOCKED" as const, restore: true };
  return input.shipmentVerified ? { status: "RESTOCKED" as const, restore: true } : { status: "INSPECTION_REQUIRED" as const, restore: false };
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
