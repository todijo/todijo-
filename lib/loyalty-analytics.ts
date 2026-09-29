import { LoyaltyFundingSource, type PrismaClient } from "@prisma/client";
import { summarizeLoyaltyLedger } from "./loyalty-ledger";

const paidStatuses = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"] as const;

/** Financial conservation is checked with signed balances, not clamped buyer
 * spendable balances: a reversed grant that was already spent creates debt. */
export function reconcileStoreLoyalty(input: {
  fundedReserveNetMinor: number; grantNetMinor: number; pendingMinor: number;
  redeemedMinor: number; expiredMinor: number; adjustedMinor: number;
  signedBalanceMinor: number; outstandingLiabilityMinor: number;
  customerOwedMinor: number; orderRedeemedNetMinor: number;
}) {
  if (Object.values(input).some(value => !Number.isSafeInteger(value)))
    throw new RangeError("INVALID_LOYALTY_RECONCILIATION");
  const issuedAvailableMinor = input.grantNetMinor - input.pendingMinor;
  const expectedBalanceMinor = issuedAvailableMinor - input.redeemedMinor -
    input.expiredMinor + input.adjustedMinor;
  const ledgerDifferenceMinor = expectedBalanceMinor - input.signedBalanceMinor;
  const accountDifferenceMinor = input.signedBalanceMinor -
    (input.outstandingLiabilityMinor - input.customerOwedMinor);
  const reserveDifferenceMinor = input.fundedReserveNetMinor - input.grantNetMinor;
  const redemptionDifferenceMinor = input.orderRedeemedNetMinor - input.redeemedMinor;
  return { issuedAvailableMinor, expectedBalanceMinor, ledgerDifferenceMinor,
    accountDifferenceMinor, reserveDifferenceMinor, redemptionDifferenceMinor,
    balanced: ledgerDifferenceMinor === 0 && accountDifferenceMinor === 0 &&
      reserveDifferenceMinor === 0 && redemptionDifferenceMinor === 0 };
}

/** Reserve, commission and customer liability are deliberately separate columns. */
export async function storeLoyaltyAccounting(db: PrismaClient, storeId: string | null) {
  // Null is the platform-wide read-only rollup; supplier/CJ groups have no
  // issuing store and must never be mistaken for a seller loyalty liability.
  const groupScope = storeId ? { storeId } : { storeId: { not: null } };
  const accountScope = storeId ? { storeId, currency: "EUR" as const }
    : { currency: "EUR" as const };
  const [groups, grants, pendingGrants, accountCount, entries, accountBalances,
    restoredAllocations, platformFunding, platformPledges, platformGrants,
    sellerSource, platformSource, unattributed] = await Promise.all([
    db.orderGroup.aggregate({ where: { ...groupScope, order: { status: { in: [...paidStatuses] } } },
      _sum: { loyaltyReserveMinor: true, loyaltyReserveReversedMinor: true,
        loyaltyRedeemedMinor: true, platformFeeAmountMinor: true,
        commissionReversedMinor: true, sellerNetAmountMinor: true, sellerRecoveredMinor: true } }),
    db.loyaltyGrant.aggregate({ where: { account: accountScope,
      fundingSource: "SELLER_RESERVE" },
      _sum: { amountMinor: true, reversedMinor: true } }),
    db.loyaltyGrant.aggregate({ where: { account: accountScope,
      fundingSource: "SELLER_RESERVE", status: "PENDING" },
      _sum: { amountMinor: true, reversedMinor: true } }),
    db.loyaltyAccount.count({ where: accountScope }),
    db.loyaltyLedgerEntry.groupBy({ by: ["event"], where: { account: accountScope },
      _sum: { amountMinor: true } }),
    db.loyaltyLedgerEntry.groupBy({ by: ["accountId"], where: {
      account: accountScope,
      event: { notIn: ["EARN_PENDING", "EARN_PENDING_REVERSED"] },
    }, _sum: { amountMinor: true } }),
    db.refundGroupAllocation.aggregate({ where: { orderGroup: groupScope,
      status: "COMPLETED" }, _sum: { loyaltyRestoredMinor: true } }),
    db.loyaltyPlatformFunding.aggregate({ where: { account: accountScope,
      attestation: { isNot: null } },
      _sum: { amountMinor: true } }),
    db.loyaltyPlatformFunding.aggregate({ where: { account: accountScope },
      _sum: { amountMinor: true } }),
    db.loyaltyGrant.aggregate({ where: { account: accountScope,
      fundingSource: "PLATFORM_ADMIN",
      platformFunding: { is: { attestation: { isNot: null } } } },
      _sum: { amountMinor: true } }),
    sourceLoyaltyAccounting(db, accountScope, LoyaltyFundingSource.SELLER_RESERVE),
    sourceLoyaltyAccounting(db, accountScope, LoyaltyFundingSource.PLATFORM_ADMIN),
    db.loyaltyLedgerEntry.count({ where: { account: accountScope, grantId: null,
      amountMinor: { not: 0 } } }),
  ]);
  const reserveMinor = groups._sum.loyaltyReserveMinor ?? 0;
  const reserveReversedMinor = groups._sum.loyaltyReserveReversedMinor ?? 0;
  const earnedMinor = grants._sum.amountMinor ?? 0;
  const earningReversedMinor = grants._sum.reversedMinor ?? 0;
  const eventAmount = (event: typeof entries[number]["event"]) =>
    entries.find(entry => entry.event === event)?._sum.amountMinor ?? 0;
  const signedMinor = entries.reduce((sum, entry) =>
    entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
      ? sum : sum + (entry._sum.amountMinor ?? 0), 0);
  const pendingMinor = (pendingGrants._sum.amountMinor ?? 0) - (pendingGrants._sum.reversedMinor ?? 0);
  const redeemedMinor = -eventAmount("REDEEM") - eventAmount("REDEEM_RESTORED");
  const expiredMinor = -eventAmount("EXPIRED") - eventAmount("EXPIRED_RESTORED");
  const adjustedMinor = eventAmount("ADMIN_ADJUSTMENT");
  const accountNettedLiabilityMinor = accountBalances.reduce((sum, account) =>
    sum + Math.max(0, account._sum.amountMinor ?? 0), 0);
  const accountNettedOwedMinor = accountBalances.reduce((sum, account) =>
    sum + Math.max(0, -(account._sum.amountMinor ?? 0)), 0);
  // Never let seller-funded customer debt silently offset a platform-funded
  // liability (or vice versa) merely because both sources share an account.
  const outstandingLiabilityMinor = sellerSource.outstandingLiabilityMinor +
    platformSource.outstandingLiabilityMinor;
  const customerOwedMinor = sellerSource.customerOwedMinor +
    platformSource.customerOwedMinor;
  const reconciliation = reconcileStoreLoyalty({
    fundedReserveNetMinor: reserveMinor - reserveReversedMinor,
    grantNetMinor: earnedMinor - earningReversedMinor,
    pendingMinor, redeemedMinor, expiredMinor, adjustedMinor,
    signedBalanceMinor: signedMinor, outstandingLiabilityMinor,
    customerOwedMinor,
    orderRedeemedNetMinor: (groups._sum.loyaltyRedeemedMinor ?? 0) -
      (restoredAllocations._sum.loyaltyRestoredMinor ?? 0),
  });
  // This detects snapshot/grant drift without pretending that an earned reserve
  // and a currently spendable balance are the same accounting quantity.
  const reserveGrantDifferenceMinor = reserveMinor - earnedMinor;
  const reversalDifferenceMinor = reserveReversedMinor - earningReversedMinor;
  const platformFundingDifferenceMinor = (platformFunding._sum.amountMinor ?? 0) -
    (platformGrants._sum.amountMinor ?? 0);
  const platformPledgeLedgerDifferenceMinor = (platformPledges._sum.amountMinor ?? 0) -
    platformSource.pendingIssuedMinor;
  const sellerGrantLedgerDifferenceMinor = earnedMinor - sellerSource.pendingIssuedMinor;
  const platformGrantLedgerDifferenceMinor = (platformGrants._sum.amountMinor ?? 0) -
    platformSource.adminCreditIssuedMinor;
  const accountCrossSourceNettingMinor = outstandingLiabilityMinor -
    accountNettedLiabilityMinor;
  const accountCrossSourceOwedNettingMinor = customerOwedMinor -
    accountNettedOwedMinor;
  const sourceRedemptionDifferenceMinor = redeemedMinor -
    sellerSource.redeemedMinor - platformSource.redeemedMinor;
  return {
    currency: "EUR" as const, storeId, accountCount,
    platformCommissionGrossMinor: groups._sum.platformFeeAmountMinor ?? 0,
    platformCommissionReversedMinor: groups._sum.commissionReversedMinor ?? 0,
    sellerPayableBeforeRefundMinor: groups._sum.sellerNetAmountMinor ?? 0,
    sellerRecoveredMinor: groups._sum.sellerRecoveredMinor ?? 0,
    reserveMinor, reserveReversedMinor,
    fundedReserveNetMinor: reserveMinor - reserveReversedMinor,
    platformFundedGrossMinor: platformFunding._sum.amountMinor ?? 0,
    platformPledgedMinor: (platformPledges._sum.amountMinor ?? 0) -
      platformSource.pendingReversedMinor,
    platformPledgeCanceledMinor: platformSource.pendingReversedMinor,
    platformFundingDifferenceMinor,
    platformPledgeLedgerDifferenceMinor,
    sellerGrantLedgerDifferenceMinor, platformGrantLedgerDifferenceMinor,
    sellerFunded: sellerSource, platformFunded: platformSource,
    accountCrossSourceNettingMinor, accountCrossSourceOwedNettingMinor,
    sourceRedemptionDifferenceMinor, unattributedLedgerEntries: unattributed,
    earnedMinor, earningReversedMinor,
    pendingMinor, signedBalanceMinor: signedMinor,
    outstandingLiabilityMinor, customerOwedMinor,
    redeemedMinor, expiredMinor, adjustedMinor,
    reserveGrantDifferenceMinor, reversalDifferenceMinor,
    ...reconciliation,
    balanced: reconciliation.balanced && reversalDifferenceMinor === 0 &&
      platformFundingDifferenceMinor === 0 && sourceRedemptionDifferenceMinor === 0 &&
      platformPledgeLedgerDifferenceMinor === 0 &&
      sellerGrantLedgerDifferenceMinor === 0 && platformGrantLedgerDifferenceMinor === 0 &&
      unattributed === 0 && sellerSource.balanced && platformSource.balanced,
  };
}

/** Seller-facing finance must never include a Todijo-funded promotion as a
 * seller obligation. Keep the full funding split on the admin-only report. */
export async function sellerLoyaltyAccounting(db: PrismaClient, storeId: string) {
  const report = await storeLoyaltyAccounting(db, storeId);
  return {
    currency: report.currency, storeId,
    fundedReserveNetMinor: report.fundedReserveNetMinor,
    reserveMinor: report.reserveMinor,
    reserveReversedMinor: report.reserveReversedMinor,
    pendingMinor: report.pendingMinor,
    outstandingLiabilityMinor: report.sellerFunded.outstandingLiabilityMinor,
    customerOwedMinor: report.sellerFunded.customerOwedMinor,
    redeemedMinor: report.sellerFunded.redeemedMinor,
    expiredMinor: report.sellerFunded.expiredMinor,
    earnedMinor: report.earnedMinor,
    earningReversedMinor: report.earningReversedMinor,
    sellerPayableBeforeRefundMinor: report.sellerPayableBeforeRefundMinor,
    sellerRecoveredMinor: report.sellerRecoveredMinor,
    balanced: report.balanced,
  };
}

/** Every monetary entry points to its originating grant. Split customer
 * exposure and redeemed funding by source; a platform grant never becomes a
 * seller reserve merely because it is redeemable at that seller's store. */
async function sourceLoyaltyAccounting(db: PrismaClient,
  accountScope: { storeId?: string; currency: "EUR" },
  fundingSource: LoyaltyFundingSource) {
  const scope = { account: accountScope, grant: { fundingSource } };
  const [events, accountBalances, allocations, adminCredits, adminDebits] = await Promise.all([
    db.loyaltyLedgerEntry.groupBy({ by: ["event"], where: scope,
      _sum: { amountMinor: true } }),
    db.loyaltyLedgerEntry.groupBy({ by: ["accountId"], where: {
      ...scope, event: { notIn: ["EARN_PENDING", "EARN_PENDING_REVERSED"] },
    }, _sum: { amountMinor: true } }),
    db.loyaltyRedemptionAllocation.aggregate({ where: {
      grant: { fundingSource, account: accountScope },
    }, _sum: { amountMinor: true, restoredMinor: true } }),
    fundingSource === LoyaltyFundingSource.PLATFORM_ADMIN
      ? db.loyaltyLedgerEntry.aggregate({ where: { ...scope,
        event: "ADMIN_ADJUSTMENT", amountMinor: { gt: 0 } },
      _sum: { amountMinor: true } })
      : Promise.resolve({ _sum: { amountMinor: 0 } }),
    fundingSource === LoyaltyFundingSource.PLATFORM_ADMIN
      ? db.loyaltyLedgerEntry.aggregate({ where: { ...scope,
        event: "ADMIN_ADJUSTMENT", amountMinor: { lt: 0 } },
      _sum: { amountMinor: true } })
      : Promise.resolve({ _sum: { amountMinor: 0 } }),
  ]);
  const amount = (event: typeof events[number]["event"]) =>
    events.find(entry => entry.event === event)?._sum.amountMinor ?? 0;
  const balances = accountBalances.map(account => account._sum.amountMinor ?? 0);
  const redeemedMinor = -amount("REDEEM") - amount("REDEEM_RESTORED");
  const allocationRedeemedMinor = (allocations._sum.amountMinor ?? 0) -
    (allocations._sum.restoredMinor ?? 0);
  const signedMinor = events.reduce((sum, entry) =>
    entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
      ? sum : sum + (entry._sum.amountMinor ?? 0), 0);
  const accountSignedMinor = balances.reduce((sum, balance) => sum + balance, 0);
  return { fundingSource,
    pendingIssuedMinor: amount("EARN_PENDING"),
    pendingReversedMinor: -amount("EARN_PENDING_REVERSED"),
    adminCreditIssuedMinor: adminCredits._sum.amountMinor ?? 0,
    issuedMinor: amount("EARN_AVAILABLE") + (adminCredits._sum.amountMinor ?? 0),
    redeemedMinor, reversedMinor: -amount("EARN_REVERSED") -
      (adminDebits._sum.amountMinor ?? 0),
    expiredMinor: -amount("EXPIRED") - amount("EXPIRED_RESTORED"),
    signedMinor, accountSignedMinor,
    outstandingLiabilityMinor: balances.reduce((sum, balance) => sum + Math.max(0, balance), 0),
    customerOwedMinor: balances.reduce((sum, balance) => sum + Math.max(0, -balance), 0),
    allocationRedeemedMinor,
    redemptionDifferenceMinor: allocationRedeemedMinor - redeemedMinor,
    balanced: signedMinor === accountSignedMinor && allocationRedeemedMinor === redeemedMinor,
  };
}

/** Expensive account-level computation is only for a requested customer trace. */
export async function customerStoreLoyaltyTrace(db: PrismaClient, buyerId: string, storeId: string) {
  const account = await db.loyaltyAccount.findUnique({ where: {
    buyerId_storeId_currency: { buyerId, storeId, currency: "EUR" },
  }, select: { id: true } });
  if (!account) return null;
  const [entries, totals, reservations] = await Promise.all([
    db.loyaltyLedgerEntry.findMany({ where: { accountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
      select: { id: true, event: true, amountMinor: true, orderId: true, grantId: true,
        grant: { select: { fundingSource: true } },
        reference: true, reason: true, createdAt: true } }),
    db.loyaltyLedgerEntry.groupBy({ by: ["event"], where: { accountId: account.id },
      _sum: { amountMinor: true } }),
    db.loyaltyRedemptionReservation.aggregate({ where: { accountId: account.id,
      status: "ACTIVE" }, _sum: { amountMinor: true } }),
  ]);
  return { accountId: account.id, buyerId, storeId,
    balance: summarizeLoyaltyLedger(totals.flatMap(total => total._sum.amountMinor
      ? [{ event: total.event, amountMinor: total._sum.amountMinor }] : []),
    reservations._sum.amountMinor ?? 0), entries };
}

/** Auditable event page. This is a flow report, not an account balance. */
export async function loyaltyEventPage(db: PrismaClient, input: {
  storeId: string;
  from: Date;
  to: Date;
  buyerId?: string;
  orderId?: string;
  cursor?: string;
}) {
  if (!input.storeId || !Number.isFinite(input.from.getTime()) ||
    !Number.isFinite(input.to.getTime()) || input.from > input.to ||
    input.to.getTime() - input.from.getTime() > 366 * 86_400_000) throw new RangeError("INVALID_LOYALTY_REPORT_RANGE");
  const rows = await db.loyaltyLedgerEntry.findMany({ where: {
    account: { storeId: input.storeId, currency: "EUR",
      ...(input.buyerId ? { buyerId: input.buyerId } : {}) },
    createdAt: { gte: input.from, lte: input.to },
    ...(input.orderId ? { orderId: input.orderId } : {}),
  }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101,
  ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  select: { id: true, accountId: true, grantId: true, orderId: true, adminId: true,
    grant: { select: { fundingSource: true } },
    event: true, amountMinor: true, reference: true, reason: true, createdAt: true } });
  return { rows: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].id : null };
}
