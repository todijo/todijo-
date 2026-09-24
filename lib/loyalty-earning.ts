import type { Prisma } from "@prisma/client";

type PaidOrderEvidence = {
  id: string;
  buyerId: string;
  currency: string;
  items: Array<{ id: string; orderGroupId: string | null; loyaltyEarnMinor: number;
    loyaltyRateBpsSnapshot: number | null; loyaltyExpiryDaysSnapshot: number | null;
    loyaltyEligibleSnapshot: boolean }>;
  groups: Array<{ id: string; storeId: string | null; loyaltyReserveMinor: number }>;
};

/** Called only inside the verified paid-Stripe-webhook transaction. */
export async function recordPaidLoyaltyEarning(tx: Prisma.TransactionClient, order: PaidOrderEvidence) {
  const groups = new Map(order.groups.map(group => [group.id, group]));
  for (const group of order.groups) {
    const grantsTotal = order.items.filter(item => item.orderGroupId === group.id)
      .reduce((sum, item) => sum + item.loyaltyEarnMinor, 0);
    if (grantsTotal !== group.loyaltyReserveMinor) throw new Error("LOYALTY_RESERVE_MISMATCH");
    if (grantsTotal > 0 && !group.storeId) throw new Error("LOYALTY_STORE_REQUIRED");
  }
  if (order.currency !== "EUR") {
    if (order.items.some(item => item.loyaltyEarnMinor > 0)) throw new Error("LOYALTY_CURRENCY_MISMATCH");
    return 0;
  }
  let created = 0;
  for (const item of order.items) {
    if (item.loyaltyEarnMinor === 0) continue;
    if (item.loyaltyEarnMinor < 0 || !item.loyaltyEligibleSnapshot ||
      !item.loyaltyRateBpsSnapshot || !item.loyaltyExpiryDaysSnapshot ||
      !item.orderGroupId) throw new Error("LOYALTY_GRANT_EVIDENCE_INVALID");
    const group = groups.get(item.orderGroupId);
    if (!group?.storeId) throw new Error("LOYALTY_GROUP_NOT_FOUND");
    const account = await tx.loyaltyAccount.upsert({
      where: { buyerId_storeId_currency: { buyerId: order.buyerId, storeId: group.storeId, currency: "EUR" } },
      create: { buyerId: order.buyerId, storeId: group.storeId, currency: "EUR" },
      update: {},
    });
    const grant = await tx.loyaltyGrant.create({ data: {
      accountId: account.id, orderItemId: item.id, orderGroupId: group.id,
      fundingSource: "SELLER_RESERVE",
      rateBps: item.loyaltyRateBpsSnapshot, expiryDays: item.loyaltyExpiryDaysSnapshot,
      amountMinor: item.loyaltyEarnMinor,
    } });
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: account.id, grantId: grant.id, orderId: order.id,
      event: "EARN_PENDING", amountMinor: item.loyaltyEarnMinor,
      reference: `earn:pending:${item.id}`,
    } });
    created++;
  }
  return created;
}
