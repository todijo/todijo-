import type { Prisma } from "@prisma/client";
import { summarizeLoyaltyLedger } from "./loyalty-ledger";

export class LoyaltyReservationError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

/**
 * Called only after checkout has resolved the current product, seller, currency,
 * eligibility and line prices. The client cannot choose a buyer or store here.
 * The account row lock serializes simultaneous devices and expiry jobs.
 */
export async function reserveLoyaltyCredit(tx: Prisma.TransactionClient, input: {
  buyerId: string;
  storeId: string;
  checkoutRequestId: string;
  currency: "EUR";
  requestedMinor: number;
  eligibleMerchandiseMinor: number;
  now: Date;
  expiresAt: Date;
}) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.checkoutRequestId) ||
    !Number.isSafeInteger(input.requestedMinor) || input.requestedMinor <= 0 ||
    !Number.isSafeInteger(input.eligibleMerchandiseMinor) || input.eligibleMerchandiseMinor < input.requestedMinor ||
    !Number.isFinite(input.now.getTime()) || !Number.isFinite(input.expiresAt.getTime()) ||
    input.expiresAt <= input.now) throw new LoyaltyReservationError("INVALID_LOYALTY_REDEMPTION", 400);
  const account = await tx.loyaltyAccount.findUnique({ where: { buyerId_storeId_currency: {
    buyerId: input.buyerId, storeId: input.storeId, currency: input.currency,
  } }, select: { id: true } });
  if (!account) throw new LoyaltyReservationError("LOYALTY_BALANCE_UNAVAILABLE");
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${account.id} FOR UPDATE`;
  const existing = await tx.loyaltyRedemptionReservation.findUnique({ where: {
    accountId_checkoutRequestId: { accountId: account.id, checkoutRequestId: input.checkoutRequestId },
  }, select: { id: true, amountMinor: true, status: true, expiresAt: true } });
  if (existing) {
    if (existing.status === "ACTIVE" && existing.expiresAt > input.now &&
      existing.amountMinor === input.requestedMinor) return existing;
    throw new LoyaltyReservationError("LOYALTY_CHECKOUT_REQUEST_FINALIZED");
  }
  const [entries, active, unexpiredGrants] = await Promise.all([
    tx.loyaltyLedgerEntry.findMany({ where: { accountId: account.id },
      select: { event: true, amountMinor: true } }),
    // A timeout is not proof that the provider payment failed. Keep the hold
    // until a verified paid/cancelled/expired transition settles it.
    tx.loyaltyRedemptionReservation.aggregate({ where: {
      accountId: account.id, status: "ACTIVE",
    }, _sum: { amountMinor: true } }),
    tx.loyaltyGrant.findMany({ where: { accountId: account.id,
      status: "AVAILABLE", expiresAt: { gt: input.now } },
    select: { entries: { select: { event: true, amountMinor: true } } } }),
  ]);
  const balance = summarizeLoyaltyLedger(entries, active._sum.amountMinor ?? 0);
  // Expiry processing is asynchronous. An overdue grant cannot be spent just
  // because its EXPIRED ledger event has not been appended yet.
  const unexpiredMinor = unexpiredGrants.reduce((sum, grant) =>
    sum + Math.max(0, grant.entries.reduce((net, entry) =>
      entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
        ? net : net + entry.amountMinor, 0)), 0);
  if (Math.min(balance.availableMinor,
    unexpiredMinor - (active._sum.amountMinor ?? 0)) < input.requestedMinor)
    throw new LoyaltyReservationError("LOYALTY_BALANCE_INSUFFICIENT");
  return tx.loyaltyRedemptionReservation.create({ data: {
    accountId: account.id, checkoutRequestId: input.checkoutRequestId,
    amountMinor: input.requestedMinor, expiresAt: input.expiresAt,
  } });
}

/** Only a server-verified cancellation/expiration path may release a hold. */
export async function releaseLoyaltyReservations(tx: Prisma.TransactionClient, buyerId: string, checkoutRequestId: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(checkoutRequestId)) throw new LoyaltyReservationError("INVALID_LOYALTY_REQUEST", 400);
  return tx.loyaltyRedemptionReservation.updateMany({ where: {
    checkoutRequestId, account: { buyerId }, status: "ACTIVE",
  }, data: { status: "RELEASED" } });
}

/**
 * Spend a previously held amount only after the caller has verified the
 * provider payment and persisted the paid order in this same transaction.
 * Grant attribution is required so later expiry can debit only unspent funds.
 */
export async function consumePaidLoyaltyReservation(tx: Prisma.TransactionClient, input: {
  buyerId: string; storeId: string; checkoutRequestId: string; orderId: string;
  expectedMinor: number;
}) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.checkoutRequestId) ||
    !input.orderId || !Number.isSafeInteger(input.expectedMinor) || input.expectedMinor <= 0)
    throw new LoyaltyReservationError("INVALID_LOYALTY_REDEMPTION", 400);
  const account = await tx.loyaltyAccount.findUnique({ where: { buyerId_storeId_currency: {
    buyerId: input.buyerId, storeId: input.storeId, currency: "EUR",
  } }, select: { id: true } });
  if (!account) throw new LoyaltyReservationError("LOYALTY_BALANCE_UNAVAILABLE");
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${account.id} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: input.orderId }, select: {
    buyerId: true, checkoutRequestId: true, status: true, groups: { where: { storeId: input.storeId },
      select: { loyaltyRedeemedMinor: true } },
  } });
  if (!order || order.buyerId !== input.buyerId ||
    order.checkoutRequestId !== input.checkoutRequestId || order.status !== "PAID" ||
    order.groups.reduce((sum, group) => sum + group.loyaltyRedeemedMinor, 0) !== input.expectedMinor)
    throw new LoyaltyReservationError("LOYALTY_PAID_ORDER_MISMATCH");
  const reservation = await tx.loyaltyRedemptionReservation.findUnique({ where: {
    accountId_checkoutRequestId: { accountId: account.id, checkoutRequestId: input.checkoutRequestId },
  }, select: { id: true, amountMinor: true, status: true } });
  if (!reservation || reservation.status !== "ACTIVE" || reservation.amountMinor !== input.expectedMinor)
    throw new LoyaltyReservationError("LOYALTY_RESERVATION_MISMATCH");
  const items = await tx.orderItem.findMany({ where: {
    orderId: input.orderId, orderGroup: { storeId: input.storeId },
    loyaltyRedeemedMinor: { gt: 0 },
  }, orderBy: { id: "asc" }, select: {
    id: true, loyaltyEligibleSnapshot: true, loyaltyRedeemedMinor: true,
  } });
  if (items.some(item => !item.loyaltyEligibleSnapshot) ||
    items.reduce((sum, item) => sum + item.loyaltyRedeemedMinor, 0) !== input.expectedMinor)
    throw new LoyaltyReservationError("LOYALTY_ITEM_ALLOCATION_MISMATCH");
  const grants = await tx.loyaltyGrant.findMany({ where: {
    accountId: account.id, status: "AVAILABLE",
  }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], select: {
    id: true, entries: { select: { event: true, amountMinor: true } },
  } });
  const sources = grants.map(grant => ({ grantId: grant.id,
    remainingMinor: Math.max(0, grant.entries.reduce((sum, entry) =>
      entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
        ? sum : sum + entry.amountMinor, 0)),
  }));
  const spends: Array<{ orderItemId: string; grantId: string; amountMinor: number }> = [];
  for (const item of items) {
    let remaining = item.loyaltyRedeemedMinor;
    for (const source of sources) {
      const amountMinor = Math.min(remaining, source.remainingMinor);
      if (amountMinor > 0) spends.push({ orderItemId: item.id,
        grantId: source.grantId, amountMinor });
      remaining -= amountMinor;
      source.remainingMinor -= amountMinor;
      if (remaining === 0) break;
    }
    if (remaining > 0) throw new LoyaltyReservationError("LOYALTY_GRANT_BALANCE_MISMATCH");
  }
  for (const spend of spends) {
    await tx.loyaltyRedemptionAllocation.create({ data: spend });
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: account.id, grantId: spend.grantId, orderId: input.orderId,
      event: "REDEEM", amountMinor: -spend.amountMinor,
      reference: `redeem:${input.orderId}:${spend.orderItemId}:${spend.grantId}`,
      metadata: { reservationId: reservation.id, orderItemId: spend.orderItemId },
    } });
  }
  const changed = await tx.loyaltyRedemptionReservation.updateMany({ where: {
    id: reservation.id, status: "ACTIVE", amountMinor: input.expectedMinor,
  }, data: { status: "CONSUMED" } });
  if (changed.count !== 1) throw new LoyaltyReservationError("LOYALTY_RESERVATION_RACE");
  return { accountId: account.id, redeemedMinor: input.expectedMinor, grants: spends };
}
