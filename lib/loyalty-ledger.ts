import type { LoyaltyLedgerEvent, PrismaClient } from "@prisma/client";

type Event = { event: LoyaltyLedgerEvent; amountMinor: number };
const CREDIT_EVENTS = new Set<LoyaltyLedgerEvent>(["EARN_PENDING", "EARN_AVAILABLE", "REDEEM_RESTORED", "EXPIRED_RESTORED"]);
const DEBIT_EVENTS = new Set<LoyaltyLedgerEvent>(["EARN_PENDING_REVERSED", "REDEEM", "EARN_REVERSED", "EXPIRED"]);

/** Signed ledger entries remain the balance authority. Pending is not spendable. */
export function summarizeLoyaltyLedger(entries: readonly Event[], activeReservationsMinor = 0) {
  if (!Number.isSafeInteger(activeReservationsMinor) || activeReservationsMinor < 0) throw new RangeError("invalid reservations");
  let signedMinor = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor === 0) throw new RangeError("invalid ledger entry");
    if (CREDIT_EVENTS.has(entry.event) && entry.amountMinor < 0) throw new RangeError("credit sign mismatch");
    if (DEBIT_EVENTS.has(entry.event) && entry.amountMinor > 0) throw new RangeError("debit sign mismatch");
    if (entry.event !== "EARN_PENDING" && entry.event !== "EARN_PENDING_REVERSED") signedMinor += entry.amountMinor;
    if (!Number.isSafeInteger(signedMinor)) throw new RangeError("ledger overflow");
  }
  return {
    signedMinor,
    availableMinor: Math.max(0, signedMinor - activeReservationsMinor),
    owedMinor: Math.max(0, -signedMinor),
    reservedMinor: activeReservationsMinor,
  };
}

/** Buyer identity comes exclusively from the validated server session. */
export async function buyerLoyaltySummary(db: PrismaClient, buyerId: string, now = new Date()) {
  const accounts = await db.loyaltyAccount.findMany({ where: { buyerId, currency: "EUR" },
    select: { id: true, storeId: true, currency: true, store: { select: { name: true, slug: true } } } });
  if (!accounts.length) return { currency: "EUR", availableMinor: 0, pendingMinor: 0,
    reservedMinor: 0,
    owedMinor: 0, expiringSoonMinor: 0, expiringSoon: [], stores: [], history: [] };
  const accountIds = accounts.map(account => account.id);
  const expiryCutoff = new Date(now.getTime() + 30 * 86_400_000);
  const [entries, reservations, pending, expiringGrants, unexpiredGrants,
    history] = await Promise.all([
    db.loyaltyLedgerEntry.findMany({ where: { accountId: { in: accountIds } },
      select: { accountId: true, event: true, amountMinor: true } }),
    db.loyaltyRedemptionReservation.groupBy({ by: ["accountId"], where: {
      accountId: { in: accountIds }, status: "ACTIVE",
    }, _sum: { amountMinor: true } }),
    db.loyaltyGrant.findMany({ where: {
      accountId: { in: accountIds }, status: "PENDING",
    }, select: { accountId: true, amountMinor: true, reversedMinor: true } }),
    db.loyaltyGrant.findMany({ where: { accountId: { in: accountIds }, status: "AVAILABLE",
      expiresAt: { gt: now, lte: expiryCutoff } },
    select: { id: true, accountId: true, expiresAt: true, orderItemId: true,
      entries: { select: { event: true, amountMinor: true } } } }),
    db.loyaltyGrant.findMany({ where: { accountId: { in: accountIds },
      status: "AVAILABLE", expiresAt: { gt: now } },
    select: { accountId: true, entries: { select: { event: true,
      amountMinor: true } } } }),
    db.loyaltyLedgerEntry.findMany({ where: { accountId: { in: accountIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
      select: { id: true, accountId: true, grantId: true, orderId: true, event: true,
        amountMinor: true, reason: true, createdAt: true } }),
  ]);
  const stores = accounts.map(account => {
    const balance = summarizeLoyaltyLedger(entries.filter(entry => entry.accountId === account.id),
      reservations.find(item => item.accountId === account.id)?._sum.amountMinor ?? 0);
    const unexpiredMinor = unexpiredGrants.filter(grant =>
      grant.accountId === account.id).reduce((sum, grant) =>
      sum + Math.max(0, grant.entries.reduce((net, entry) =>
        entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
          ? net : net + entry.amountMinor, 0)), 0);
    return { storeId: account.storeId, storeName: account.store.name, storeSlug: account.store.slug,
      ...balance, availableMinor: Math.min(balance.availableMinor,
        Math.max(0, unexpiredMinor - balance.reservedMinor)),
      pendingMinor: pending.filter(item => item.accountId === account.id)
        .reduce((sum, item) => sum + item.amountMinor - item.reversedMinor, 0) };
  });
  const expiringSoon = expiringGrants.flatMap(grant => {
    const remainingMinor = Math.max(0, grant.entries.reduce((sum, entry) =>
      entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
        ? sum : sum + entry.amountMinor, 0));
    return remainingMinor ? [{ storeId: accounts.find(account => account.id === grant.accountId)!.storeId,
      orderItemId: grant.orderItemId, amountMinor: remainingMinor, expiresAt: grant.expiresAt! }] : [];
  }).sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime());
  return { currency: "EUR",
    availableMinor: stores.reduce((sum, store) => sum + store.availableMinor, 0),
    reservedMinor: stores.reduce((sum, store) => sum + store.reservedMinor, 0),
    pendingMinor: stores.reduce((sum, store) => sum + store.pendingMinor, 0),
    owedMinor: stores.reduce((sum, store) => sum + store.owedMinor, 0),
    expiringSoonMinor: expiringSoon.reduce((sum, grant) => sum + grant.amountMinor, 0),
    expiringSoon: expiringSoon.slice(0, 50), stores, history };
}
