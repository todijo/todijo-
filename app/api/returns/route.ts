import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isAdminRole } from "@/lib/admin-access";
import { isAuthoritativeStage4Return } from "@/lib/inventory-restock";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!actor || (actor.role !== "SELLER" && !isAdminRole(actor.role))) return NextResponse.json({ error: "Returns not found." }, { status: 404 });
  const rows = await prisma.inventoryRestockEvent.findMany({
    where: {
      lifecycleKey: { not: null },
      refundOperation: { status: "COMPLETED" },
      orderItem: { orderGroup: { kind: "MARKETPLACE", ...(isAdminRole(actor.role) ? {} : { store: { ownerId: session.userId } }) } },
    },
    select: { id: true, refundOperationId: true, orderItemId: true, lifecycleKey: true, quantity: true, status: true, reason: true, trackingCarrier: true, trackingNumber: true, trackingSubmittedAt: true, receivedAt: true, inspectedAt: true, inspectionReason: true, restoredAt: true, createdAt: true, refundOperation: { select: { status: true } }, orderItem: { select: { id: true, productNameSnapshot: true, variantId: true, orderGroupId: true, orderGroup: { select: { kind: true } }, order: { select: { id: true } } } } },
    orderBy: { createdAt: "desc" }, take: 250,
  });
  return NextResponse.json(rows.filter(isAuthoritativeStage4Return).slice(0, 100).map((candidate) => {
    const { lifecycleKey, refundOperationId, orderItemId, refundOperation, ...row } = candidate;
    void lifecycleKey; void refundOperationId; void orderItemId; void refundOperation;
    return row;
  }));
}
