import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isAdminRole } from "@/lib/admin-access";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!actor || (actor.role !== "SELLER" && !isAdminRole(actor.role))) return NextResponse.json({ error: "Returns not found." }, { status: 404 });
  const rows = await prisma.inventoryRestockEvent.findMany({
    where: isAdminRole(actor.role) ? {} : { orderItem: { orderGroup: { kind: "MARKETPLACE", store: { ownerId: session.userId } } } },
    select: { id: true, quantity: true, status: true, reason: true, trackingCarrier: true, trackingNumber: true, trackingSubmittedAt: true, receivedAt: true, inspectedAt: true, inspectionReason: true, restoredAt: true, createdAt: true, orderItem: { select: { id: true, productNameSnapshot: true, variantId: true, orderGroupId: true, order: { select: { id: true } } } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return NextResponse.json(rows);
}
