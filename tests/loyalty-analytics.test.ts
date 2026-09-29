import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { loyaltyEventPage, reconcileStoreLoyalty, sellerLoyaltyAccounting,
  storeLoyaltyAccounting } from "../lib/loyalty-analytics";

function fixture(grantMinor: number, reversalMinor: number, platformMinor = 0) {
  const db = {
    orderGroup: { aggregate: async () => ({ _sum: {
      loyaltyReserveMinor: 200, loyaltyReserveReversedMinor: 50,
      loyaltyRedeemedMinor: 30, platformFeeAmountMinor: 1000,
      commissionReversedMinor: 250, sellerNetAmountMinor: 8800,
      sellerRecoveredMinor: 2200,
    } }) },
    loyaltyGrant: { aggregate: async ({ where }: { where: { status?: string; fundingSource?: string } }) => ({ _sum: {
      amountMinor: where.status === "PENDING" ? 0 :
        where.fundingSource === "PLATFORM_ADMIN" ? platformMinor : grantMinor,
      reversedMinor: where.status === "PENDING" || where.fundingSource === "PLATFORM_ADMIN" ? 0 : reversalMinor,
    } }) },
    loyaltyAccount: { count: async () => 2 },
    loyaltyPlatformFunding: { aggregate: async () => ({ _sum: { amountMinor: platformMinor } }) },
    loyaltyRedemptionAllocation: { aggregate: async ({ where }: { where: { grant: { fundingSource: string } } }) =>
      ({ _sum: { amountMinor: where.grant.fundingSource === "SELLER_RESERVE" ? 30 : 0,
        restoredMinor: 0 } }) },
    refundGroupAllocation: { aggregate: async () => ({ _sum: { loyaltyRestoredMinor: 0 } }) },
    loyaltyLedgerEntry: { count: async () => 0,
      aggregate: async ({ where }: any) => ({ _sum: {
        amountMinor: where.amountMinor?.lt === 0 ? 0 : platformMinor,
      } }),
      groupBy: async ({ by, where }: { by: string[]; where?: { grant?: { fundingSource: string } } }) =>
      by[0] === "accountId"
      ? where?.grant?.fundingSource === "PLATFORM_ADMIN"
        ? [{ accountId: "account-a", _sum: { amountMinor: platformMinor } }]
        : [{ accountId: "account-a", _sum: { amountMinor: 120 + (where?.grant ? 0 : platformMinor) } },
          { accountId: "account-b", _sum: { amountMinor: -20 } }]
      : where?.grant?.fundingSource === "PLATFORM_ADMIN"
        ? platformMinor ? [
          { event: "EARN_PENDING", _sum: { amountMinor: platformMinor } },
          { event: "ADMIN_ADJUSTMENT", _sum: { amountMinor: platformMinor } },
        ] : []
      : [
        { event: "EARN_PENDING", _sum: { amountMinor: 200 } },
        { event: "EARN_PENDING_REVERSED", _sum: { amountMinor: -50 } },
        { event: "EARN_AVAILABLE", _sum: { amountMinor: 150 } },
        { event: "REDEEM", _sum: { amountMinor: -30 } },
        { event: "EXPIRED", _sum: { amountMinor: -20 } },
        ...(where?.grant ? [] : platformMinor
          ? [{ event: "ADMIN_ADJUSTMENT", _sum: { amountMinor: platformMinor } }] : []),
      ] },
  } as unknown as PrismaClient;
  return db;
}

test("reserve reconciliation keeps platform commission, seller payable and liability separate", async () => {
  const report = await storeLoyaltyAccounting(fixture(200, 50), "store-a");
  assert.equal(report.balanced, true);
  assert.equal(report.fundedReserveNetMinor, 150);
  assert.equal(report.platformCommissionGrossMinor, 1000);
  assert.equal(report.sellerPayableBeforeRefundMinor, 8800);
  assert.equal(report.pendingMinor, 0);
  assert.equal(report.signedBalanceMinor, 100);
  assert.equal(report.outstandingLiabilityMinor, 120);
  assert.equal(report.customerOwedMinor, 20);
  assert.equal(report.redeemedMinor, 30);
  assert.equal(report.expiredMinor, 20);
});

test("missing grant or refund reversal is surfaced instead of silently netted", async () => {
  const report = await storeLoyaltyAccounting(fixture(180, 40), "store-a");
  assert.equal(report.balanced, false);
  assert.equal(report.reserveGrantDifferenceMinor, 20);
  assert.equal(report.reversalDifferenceMinor, 10);
});

test("platform admin funding cannot be mistaken for seller reserve or silently disappear", async () => {
  const db = fixture(200, 50, 40) as unknown as Record<string, {
    aggregate: (args?: any) => Promise<any>;
  }>;
  const balanced = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(balanced.balanced, true);
  assert.equal(balanced.fundedReserveNetMinor, 150);
  assert.equal(balanced.platformFundedGrossMinor, 40);
  db.loyaltyPlatformFunding.aggregate = async () => ({ _sum: { amountMinor: 30 } });
  const drift = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(drift.platformFundingDifferenceMinor, -10);
  assert.equal(drift.balanced, false);
  db.loyaltyPlatformFunding.aggregate = async () => ({ _sum: { amountMinor: 40 } });
  (db.loyaltyLedgerEntry as any).aggregate = async () => ({ _sum: { amountMinor: 0 } });
  const missingIssue = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(missingIssue.platformGrantLedgerDifferenceMinor, 40);
  assert.equal(missingIssue.balanced, false);
});

test("unattested platform pledge is pending, not spendable cash-backed liability", async () => {
  const db = fixture(200, 50, 40) as unknown as Record<string, {
    aggregate?: (args: any) => Promise<any>;
    groupBy?: (args: any) => Promise<any>;
  }>;
  db.loyaltyPlatformFunding.aggregate = async args => ({ _sum: {
    amountMinor: args.where.attestation ? 0 : 40,
  } });
  const grantAggregate = db.loyaltyGrant.aggregate!;
  db.loyaltyGrant.aggregate = async args => args.where.fundingSource === "PLATFORM_ADMIN"
    ? { _sum: { amountMinor: 0 } } : grantAggregate(args);
  const ledgerGroupBy = db.loyaltyLedgerEntry.groupBy!;
  db.loyaltyLedgerEntry.groupBy = async args => {
    const rows = await ledgerGroupBy(args);
    if (args.where?.grant?.fundingSource === "PLATFORM_ADMIN")
      return args.by[0] === "accountId" ? [] :
        [{ event: "EARN_PENDING", _sum: { amountMinor: 40 } }];
    if (args.where?.grant) return rows;
    if (args.by[0] === "accountId") return rows.map((row: any) => row.accountId === "account-a"
      ? { ...row, _sum: { amountMinor: 120 } } : row);
    return rows.filter((row: any) => row.event !== "ADMIN_ADJUSTMENT");
  };
  db.loyaltyLedgerEntry.aggregate = async () => ({ _sum: { amountMinor: 0 } });
  const report = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(report.balanced, true);
  assert.equal(report.platformPledgedMinor, 40);
  assert.equal(report.platformFundedGrossMinor, 0);
  assert.equal(report.platformFunded.outstandingLiabilityMinor, 0);
  const pendingGroupBy = db.loyaltyLedgerEntry.groupBy!;
  db.loyaltyLedgerEntry.groupBy = async args => {
    const rows = await pendingGroupBy(args);
    return args.by[0] === "event" ? [...rows,
      { event: "EARN_PENDING_REVERSED", _sum: { amountMinor: -40 } }] : rows;
  };
  const canceled = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(canceled.balanced, true);
  assert.equal(canceled.platformPledgeCanceledMinor, 40);
  assert.equal(canceled.platformPledgedMinor, 0);
});

test("platform reversal remains visible separately from gross issuance", async () => {
  const db = fixture(200, 50, 40) as unknown as Record<string, {
    aggregate?: (args: any) => Promise<any>;
    groupBy?: (args: any) => Promise<any>;
  }>;
  db.loyaltyLedgerEntry.aggregate = async args => ({ _sum: {
    amountMinor: args.where.amountMinor.lt === 0 ? -10 : 40,
  } });
  const original = db.loyaltyLedgerEntry.groupBy!;
  db.loyaltyLedgerEntry.groupBy = async args => {
    const rows = await original(args);
    if (args.by[0] === "accountId") return rows.map((row: any) => row.accountId === "account-a"
      ? { ...row, _sum: { amountMinor: args.where?.grant ?
        args.where.grant.fundingSource === "PLATFORM_ADMIN" ? 30 : 120 : 150 } } : row);
    return rows.map((row: any) => row.event === "ADMIN_ADJUSTMENT"
      ? { ...row, _sum: { amountMinor: 30 } } : row);
  };
  const report = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(report.balanced, true);
  assert.equal(report.platformFunded.issuedMinor, 40);
  assert.equal(report.platformFunded.reversedMinor, 10);
  assert.equal(report.platformFunded.outstandingLiabilityMinor, 30);
});

test("seller-facing finance excludes platform goodwill liability and redemptions", async () => {
  const report = await sellerLoyaltyAccounting(fixture(200, 50, 40), "store-a");
  assert.equal(report.outstandingLiabilityMinor, 120);
  assert.equal(report.redeemedMinor, 30);
  assert.equal(report.fundedReserveNetMinor, 150);
  assert.equal("platformFundedGrossMinor" in report, false);
  assert.equal("platformFunded" in report, false);
});

test("mixed seller and platform redemptions retain separate liabilities", async () => {
  const db = fixture(200, 50, 40) as unknown as Record<string, {
    aggregate?: (args: any) => Promise<any>;
    groupBy?: (args: any) => Promise<any>;
  }>;
  const groupAggregate = db.orderGroup.aggregate!;
  db.orderGroup.aggregate = async args => {
    const row = await groupAggregate(args);
    return { _sum: { ...row._sum, loyaltyRedeemedMinor: 40 } };
  };
  const allocationAggregate = db.loyaltyRedemptionAllocation.aggregate!;
  db.loyaltyRedemptionAllocation.aggregate = async args =>
    args.where.grant.fundingSource === "PLATFORM_ADMIN"
      ? { _sum: { amountMinor: 10, restoredMinor: 0 } }
      : allocationAggregate(args);
  const ledgerGroupBy = db.loyaltyLedgerEntry.groupBy!;
  db.loyaltyLedgerEntry.groupBy = async args => {
    const source = args.where?.grant?.fundingSource;
    if (source === "PLATFORM_ADMIN") return args.by[0] === "accountId"
      ? [{ accountId: "account-a", _sum: { amountMinor: 30 } }]
      : [{ event: "EARN_PENDING", _sum: { amountMinor: 40 } },
        { event: "ADMIN_ADJUSTMENT", _sum: { amountMinor: 40 } },
        { event: "REDEEM", _sum: { amountMinor: -10 } }];
    const rows = await ledgerGroupBy(args);
    if (source) return rows;
    if (args.by[0] === "accountId") return rows.map((row: any) => row.accountId === "account-a"
      ? { ...row, _sum: { amountMinor: 150 } } : row);
    return rows.map((row: any) => row.event === "REDEEM"
      ? { ...row, _sum: { amountMinor: -40 } } : row);
  };
  const admin = await storeLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(admin.balanced, true);
  assert.equal(admin.sellerFunded.redeemedMinor, 30);
  assert.equal(admin.platformFunded.redeemedMinor, 10);
  assert.equal(admin.sellerFunded.outstandingLiabilityMinor, 120);
  assert.equal(admin.platformFunded.outstandingLiabilityMinor, 30);
  const seller = await sellerLoyaltyAccounting(db as unknown as PrismaClient, "store-a");
  assert.equal(seller.redeemedMinor, 30);
  assert.equal(seller.outstandingLiabilityMinor, 120);
});

test("platform credit cannot hide seller-funded customer debt in global liability", async () => {
  const db = fixture(200, 50, 40) as unknown as Record<string, {
    groupBy?: (args: any) => Promise<any>;
  }>;
  const original = db.loyaltyLedgerEntry.groupBy!;
  db.loyaltyLedgerEntry.groupBy = async args => {
    const rows = await original(args);
    if (args.by[0] !== "accountId") return rows;
    if (args.where?.grant?.fundingSource === "PLATFORM_ADMIN")
      return [{ accountId: "account-b", _sum: { amountMinor: 40 } }];
    if (args.where?.grant) return rows;
    return [{ accountId: "account-a", _sum: { amountMinor: 120 } },
      { accountId: "account-b", _sum: { amountMinor: 20 } }];
  };
  const report = await storeLoyaltyAccounting(db as unknown as PrismaClient, null);
  assert.equal(report.balanced, true);
  assert.equal(report.outstandingLiabilityMinor, 160);
  assert.equal(report.customerOwedMinor, 20);
  assert.equal(report.sellerFunded.outstandingLiabilityMinor, 120);
  assert.equal(report.platformFunded.outstandingLiabilityMinor, 40);
  assert.equal(report.accountCrossSourceNettingMinor, 20);
  assert.equal(report.accountCrossSourceOwedNettingMinor, 20);
});

test("global reconciliation excludes supplier groups but includes every seller account", async () => {
  const seen: Record<string, unknown>[] = [];
  const source = fixture(200, 50) as unknown as Record<string, {
    aggregate?: (args: any) => Promise<any>;
    groupBy?: (args: any) => Promise<any>;
  }>;
  for (const name of ["orderGroup", "loyaltyGrant", "refundGroupAllocation"]) {
    const aggregate = source[name].aggregate!;
    source[name].aggregate = async args => { seen.push({ name, where: args.where }); return aggregate(args); };
  }
  const report = await storeLoyaltyAccounting(source as unknown as PrismaClient, null);
  assert.equal(report.balanced, true);
  assert.equal(report.storeId, null);
  assert.deepEqual(seen.find(row => row.name === "orderGroup")?.where,
    { storeId: { not: null }, order: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"] } } });
  assert.deepEqual(seen.find(row => row.name === "loyaltyGrant")?.where,
    { account: { currency: "EUR" }, fundingSource: "SELLER_RESERVE" });
  assert.deepEqual(seen.find(row => row.name === "refundGroupAllocation")?.where,
    { orderGroup: { storeId: { not: null } }, status: "COMPLETED" });
});

test("reconciliation proves reserve, ledger, customer debt and order redemption agree", () => {
  const base = { fundedReserveNetMinor: 150, grantNetMinor: 150,
    pendingMinor: 0, redeemedMinor: 30, expiredMinor: 20,
    adjustedMinor: 0, signedBalanceMinor: 100,
    outstandingLiabilityMinor: 120, customerOwedMinor: 20,
    orderRedeemedNetMinor: 30 };
  assert.equal(reconcileStoreLoyalty(base).balanced, true);
  assert.equal(reconcileStoreLoyalty({ ...base, orderRedeemedNetMinor: 60 })
    .redemptionDifferenceMinor, 30);
  assert.equal(reconcileStoreLoyalty({ ...base, outstandingLiabilityMinor: 125 })
    .balanced, false);
  assert.equal(reconcileStoreLoyalty({ ...base, fundedReserveNetMinor: 160 })
    .balanced, false);
  assert.equal(reconcileStoreLoyalty({ ...base, customerOwedMinor: 0 })
    .balanced, false);
  assert.throws(() => reconcileStoreLoyalty({ ...base,
    redeemedMinor: Number.MAX_SAFE_INTEGER + 1 }), /INVALID_LOYALTY_RECONCILIATION/);
});

test("admin event reporting is store-scoped, bounded and paginated", async () => {
  let observed: Record<string, unknown> | null = null;
  const db = { loyaltyLedgerEntry: { findMany: async (args: Record<string, unknown>) => {
    observed = args;
    return Array.from({ length: 101 }, (_, index) => ({ id: `entry-${index}` }));
  } } } as unknown as PrismaClient;
  const page = await loyaltyEventPage(db, { storeId: "store-a",
    buyerId: "buyer-a", orderId: "order-a",
    from: new Date("2026-09-01"), to: new Date("2026-09-30") });
  assert.equal(page.rows.length, 100);
  assert.equal(page.nextCursor, "entry-99");
  assert.deepEqual((observed as unknown as { where: { account: unknown } }).where.account,
    { storeId: "store-a", currency: "EUR", buyerId: "buyer-a" });
  await assert.rejects(loyaltyEventPage(db, { storeId: "store-a",
    from: new Date("2025-01-01"), to: new Date("2026-09-30") }),
    { message: "INVALID_LOYALTY_REPORT_RANGE" });
});
