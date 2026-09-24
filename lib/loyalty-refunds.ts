import type { Prisma } from "@prisma/client";
import { loyaltyReserveReversalMinor } from "./loyalty-calculation";

/** Invoked only after Stripe's refund is confirmed in the refund transaction. */
export async function reverseRefundedLoyalty(tx: Prisma.TransactionClient, operationId: string, orderId: string) {
  const allocations = await tx.refundItemAllocation.findMany({
    where: { refundOperationId: operationId },
    select: { orderItemId: true, orderItem: { select: { quantity: true,
      loyaltyGrant: { select: { id: true, accountId: true, amountMinor: true,
        reversedMinor: true, status: true } } } } },
  });
  // The same account locks are used by redemption and expiry. Sorting avoids
  // deadlocks when a mixed-store refund touches several funded balances.
  const accountIds = [...new Set(allocations.flatMap(allocation =>
    allocation.orderItem.loyaltyGrant ? [allocation.orderItem.loyaltyGrant.accountId] : []))].sort();
  for (const accountId of accountIds) await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${accountId} FOR UPDATE`;
  let reversedMinor = 0;
  let availableReversedMinor = 0;
  for (const allocation of allocations) {
    const grant = allocation.orderItem.loyaltyGrant;
    if (!grant) continue;
    const completed = await tx.refundItemAllocation.findMany({ where: {
      orderItemId: allocation.orderItemId, refundOperation: { status: "COMPLETED" },
    }, select: { quantity: true } });
    const cumulativeQuantity = completed.reduce((sum, item) => sum + item.quantity, 0);
    if (cumulativeQuantity > allocation.orderItem.quantity) throw new Error("LOYALTY_REFUND_QUANTITY_EXCEEDED");
    const delta = loyaltyReserveReversalMinor({ grantMinor: grant.amountMinor,
      originalQuantity: allocation.orderItem.quantity,
      cumulativeRefundedQuantity: cumulativeQuantity,
      previouslyReversedMinor: grant.reversedMinor });
    if (delta === 0) continue;
    const targetReversed = grant.reversedMinor + delta;
    const changed = await tx.loyaltyGrant.updateMany({ where: {
      id: grant.id, reversedMinor: grant.reversedMinor, status: grant.status,
    }, data: { reversedMinor: { increment: delta },
      ...(targetReversed === grant.amountMinor ? { status: "REVERSED" } : {}) } });
    if (changed.count !== 1) throw new Error("LOYALTY_REFUND_RACE");
    if (grant.status === "EXPIRED") {
      const expirationEntries = await tx.loyaltyLedgerEntry.findMany({ where: {
        grantId: grant.id, event: { in: ["EXPIRED", "EXPIRED_RESTORED"] },
      }, select: { amountMinor: true } });
      const outstandingExpired = -expirationEntries.reduce((sum, entry) => sum + entry.amountMinor, 0);
      const restoredMinor = Math.min(delta, Math.max(0, outstandingExpired));
      if (restoredMinor > 0) await tx.loyaltyLedgerEntry.create({ data: {
        accountId: grant.accountId, grantId: grant.id, orderId,
        event: "EXPIRED_RESTORED", amountMinor: restoredMinor,
        reference: `earn:expiry-restored:${operationId}:${grant.id}`,
      } });
    }
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: grant.accountId, grantId: grant.id, orderId,
      event: grant.status === "PENDING" ? "EARN_PENDING_REVERSED" : "EARN_REVERSED",
      amountMinor: -delta, reference: `earn:refund:${operationId}:${grant.id}`,
    } });
    reversedMinor += delta;
    if (grant.status !== "PENDING") availableReversedMinor += delta;
  }
  if (availableReversedMinor > 0) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId },
      select: { buyerId: true } });
    await tx.notification.create({ data: { userId: order.buyerId,
      type: "LOYALTY_REVERSED", title: "Crédit fidélité ajusté",
      body: "Un remboursement a modifié votre crédit fidélité.", href: "/account/loyalty" } });
  }
  return reversedMinor;
}

/** Restore only the redeemed portion of confirmed refunded order-item units. */
export async function restoreRefundedLoyalty(tx: Prisma.TransactionClient,
  operationId: string, orderId: string, now = new Date()) {
  const items = await tx.refundItemAllocation.findMany({ where: { refundOperationId: operationId },
    select: { orderItemId: true, orderItem: { select: { quantity: true,
      loyaltyRedemptionAllocations: { select: { id: true, grantId: true,
        amountMinor: true, restoredMinor: true, grant: { select: { accountId: true,
          status: true, expiresAt: true } } } } } } } });
  const accountIds = [...new Set(items.flatMap(item => item.orderItem.loyaltyRedemptionAllocations
    .map(allocation => allocation.grant.accountId)))].sort();
  for (const accountId of accountIds) await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${accountId} FOR UPDATE`;
  let restoredMinor = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.orderItem.quantity) || item.orderItem.quantity <= 0)
      throw new Error("LOYALTY_REFUND_QUANTITY_INVALID");
    const confirmed = await tx.refundItemAllocation.findMany({ where: {
      orderItemId: item.orderItemId, refundOperation: { status: "COMPLETED" },
    }, select: { quantity: true } });
    const quantity = confirmed.reduce((sum, row) => sum + row.quantity, 0);
    if (quantity < 0 || quantity > item.orderItem.quantity) throw new Error("LOYALTY_REFUND_QUANTITY_EXCEEDED");
    for (const allocation of item.orderItem.loyaltyRedemptionAllocations) {
      const target = Math.floor(allocation.amountMinor * quantity / item.orderItem.quantity);
      const delta = target - allocation.restoredMinor;
      if (delta < 0) throw new Error("LOYALTY_RESTORATION_REGRESSION");
      if (delta === 0) continue;
      const changed = await tx.loyaltyRedemptionAllocation.updateMany({ where: {
        id: allocation.id, restoredMinor: allocation.restoredMinor,
      }, data: { restoredMinor: { increment: delta } } });
      if (changed.count !== 1) throw new Error("LOYALTY_RESTORATION_RACE");
      await tx.loyaltyLedgerEntry.create({ data: {
        accountId: allocation.grant.accountId, grantId: allocation.grantId,
        orderId, event: "REDEEM_RESTORED", amountMinor: delta,
        reference: `redeem:restored:${operationId}:${allocation.id}`,
      } });
      restoredMinor += delta;
      if (allocation.grant.status === "EXPIRED" ||
        (allocation.grant.expiresAt && allocation.grant.expiresAt <= now)) {
        const grantEntries = await tx.loyaltyLedgerEntry.findMany({ where: {
          grantId: allocation.grantId,
        }, select: { event: true, amountMinor: true } });
        const unexpiredMinor = Math.max(0, grantEntries.reduce((sum, entry) =>
          entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
            ? sum : sum + entry.amountMinor, 0));
        if (unexpiredMinor > 0) await tx.loyaltyLedgerEntry.create({ data: {
          accountId: allocation.grant.accountId, grantId: allocation.grantId,
          orderId, event: "EXPIRED", amountMinor: -unexpiredMinor,
          reference: `redeem:refund-expired:${operationId}:${allocation.id}`,
        } });
      }
    }
  }
  return restoredMinor;
}
