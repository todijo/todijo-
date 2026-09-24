import type { Prisma } from "@prisma/client";

/** Delivery is the chosen authoritative availability milestone. */
export async function releaseDeliveredLoyalty(tx: Prisma.TransactionClient, orderId: string, now = new Date()) {
  const order = await tx.order.findUnique({ where: { id: orderId },
    select: { status: true, paidAt: true, buyerId: true } });
  if (!order || order.status !== "DELIVERED" || !order.paidAt) return 0;
  const request = await tx.refundRequest.findUnique({ where: { orderId }, select: { status: true } });
  if (request && !["SELLER_REJECTED", "ADMIN_REJECTED"].includes(request.status)) {
    const operation = await tx.refundOperation.findFirst({ where: { orderId }, select: { status: true } });
    if (operation?.status !== "COMPLETED") return 0;
  }
  const grants = await tx.loyaltyGrant.findMany({ where: {
    status: "PENDING", fundingSource: "SELLER_RESERVE", orderItem: { orderId },
  }, select: { id: true, accountId: true, amountMinor: true, reversedMinor: true,
    expiryDays: true, orderItemId: true } });
  let releasedMinor = 0;
  for (const grant of grants) {
    if (!grant.orderItemId) throw new Error("LOYALTY_SELLER_GRANT_SOURCE_MISSING");
    const amountMinor = grant.amountMinor - grant.reversedMinor;
    if (amountMinor <= 0) continue;
    const expiresAt = new Date(now.getTime() + grant.expiryDays * 86_400_000);
    const changed = await tx.loyaltyGrant.updateMany({ where: {
      id: grant.id, status: "PENDING", reversedMinor: grant.reversedMinor,
    }, data: { status: "AVAILABLE", availableAt: now, expiresAt } });
    if (changed.count !== 1) throw new Error("LOYALTY_RELEASE_RACE");
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: grant.accountId, grantId: grant.id, orderId,
      event: "EARN_AVAILABLE", amountMinor,
      reference: `earn:available:${grant.orderItemId}`,
    } });
    releasedMinor += amountMinor;
  }
  if (releasedMinor > 0) await tx.notification.create({ data: {
    userId: order.buyerId, type: "LOYALTY_AVAILABLE", title: "Crédit fidélité disponible",
    body: "Votre crédit fidélité est maintenant disponible.", href: "/account/loyalty",
  } });
  return releasedMinor;
}
