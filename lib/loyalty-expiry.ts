import { Prisma, type PrismaClient } from "@prisma/client";
import { releaseDeliveredLoyalty } from "./loyalty-availability";

/** A grant is warned once, only while it still has spendable value. */
export async function warnExpiringLoyaltyGrant(tx: Prisma.TransactionClient, grantId: string, now: Date) {
  const grant = await tx.loyaltyGrant.findUnique({ where: { id: grantId }, select: {
    id: true, accountId: true, status: true, expiresAt: true, expiryWarnedAt: true,
    account: { select: { buyerId: true } },
  } });
  const warningCutoff = new Date(now.getTime() + 30 * 86_400_000);
  if (!grant || grant.status !== "AVAILABLE" || grant.expiryWarnedAt || !grant.expiresAt ||
    grant.expiresAt <= now || grant.expiresAt > warningCutoff) return false;
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${grant.accountId} FOR UPDATE`;
  const entries = await tx.loyaltyLedgerEntry.findMany({ where: { grantId },
    select: { event: true, amountMinor: true } });
  const remaining = entries.reduce((sum, entry) =>
    entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
      ? sum : sum + entry.amountMinor, 0);
  if (remaining <= 0) return false;
  const changed = await tx.loyaltyGrant.updateMany({ where: {
    id: grantId, status: "AVAILABLE", expiryWarnedAt: null,
  }, data: { expiryWarnedAt: now } });
  if (changed.count !== 1) throw new Error("LOYALTY_EXPIRY_WARNING_RACE");
  await tx.notification.create({ data: { userId: grant.account.buyerId,
    type: "LOYALTY_EXPIRING", title: "Crédit fidélité bientôt expiré",
    body: "Une partie de votre crédit fidélité expire bientôt.", href: "/account/loyalty" } });
  return true;
}

export async function expireLoyaltyGrant(tx: Prisma.TransactionClient, grantId: string, now: Date) {
  const grant = await tx.loyaltyGrant.findUnique({ where: { id: grantId }, select: {
    id: true, accountId: true, orderItemId: true, status: true, expiresAt: true,
    account: { select: { buyerId: true } },
  } });
  if (!grant || grant.status !== "AVAILABLE" || !grant.expiresAt || grant.expiresAt > now) return 0;
  // The account lock serializes expiry with checkout reservations/redemption.
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${grant.accountId} FOR UPDATE`;
  const activeReservations = await tx.loyaltyRedemptionReservation.count({ where: {
    accountId: grant.accountId, status: "ACTIVE",
  } });
  if (activeReservations) return 0;
  const entries = await tx.loyaltyLedgerEntry.findMany({ where: { grantId },
    select: { event: true, amountMinor: true } });
  const remaining = Math.max(0, entries.reduce((sum, entry) =>
    entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
      ? sum : sum + entry.amountMinor, 0));
  const changed = await tx.loyaltyGrant.updateMany({ where: { id: grantId, status: "AVAILABLE" },
    data: { status: "EXPIRED" } });
  if (changed.count !== 1) throw new Error("LOYALTY_EXPIRY_RACE");
  if (remaining > 0) {
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: grant.accountId, grantId, event: "EXPIRED", amountMinor: -remaining,
      reference: `earn:expired:${grant.orderItemId ?? grant.id}`,
    } });
    await tx.notification.create({ data: { userId: grant.account.buyerId,
      type: "LOYALTY_EXPIRED", title: "Crédit fidélité expiré",
      body: "Une partie de votre crédit fidélité a expiré.", href: "/account/loyalty" } });
  }
  return remaining;
}

export async function processDueLoyalty(db: PrismaClient, now = new Date()) {
  const pending = await db.loyaltyGrant.findMany({ where: {
    status: "PENDING", fundingSource: "SELLER_RESERVE",
    orderItem: { order: { status: "DELIVERED" } },
  }, take: 100, select: { orderItem: { select: { orderId: true } } } });
  let releasedMinor = 0;
  for (const orderId of new Set(pending.flatMap(grant =>
    grant.orderItem ? [grant.orderItem.orderId] : []))) {
    releasedMinor += await db.$transaction(tx => releaseDeliveredLoyalty(tx, orderId, now),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  const warningCutoff = new Date(now.getTime() + 30 * 86_400_000);
  const expiring = await db.loyaltyGrant.findMany({ where: {
    status: "AVAILABLE", expiryWarnedAt: null,
    expiresAt: { gt: now, lte: warningCutoff },
  }, take: 100, select: { id: true } });
  let warnedCount = 0;
  for (const grant of expiring) if (await db.$transaction(
    tx => warnExpiringLoyaltyGrant(tx, grant.id, now),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })) warnedCount++;
  const due = await db.loyaltyGrant.findMany({ where: {
    status: "AVAILABLE", expiresAt: { lte: now },
  }, take: 100, select: { id: true } });
  let expiredMinor = 0;
  for (const grant of due) expiredMinor += await db.$transaction(
    tx => expireLoyaltyGrant(tx, grant.id, now),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { releasedMinor, warnedCount, expiredMinor };
}
