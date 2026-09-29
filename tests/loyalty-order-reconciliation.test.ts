import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { auditOrderLoyaltySnapshot, orderLoyaltyFundingTrace, reconcileOrderFunding,
  type OrderFundingEvidence } from "../lib/loyalty-order-reconciliation";

const base: OrderFundingEvidence = {
  merchandiseMinor: 5000, shippingMinor: 0, redeemedMinor: 0,
  sellerRedeemedMinor: 0, platformRedeemedMinor: 0,
  sellerRestoredMinor: 0, platformRestoredMinor: 0,
  newCashMinor: 5000, commissionBaseMinor: 5000,
  commissionMinor: 500, newSellerReserveMinor: 100,
  sellerPayableMinor: 4400, refundedMerchandiseMinor: 0,
  refundedCashMerchandiseMinor: 0, refundedShippingMinor: 0,
  refundedLoyaltyMinor: 0, commissionReversedMinor: 0,
  sellerRecoveredMinor: 0, sellerReserveReversedMinor: 0,
};

test("cash, seller reserve, platform goodwill, mixed and zero-cash settlement conserve euros", () => {
  const cases: Array<[string, number, number, number, number, number]> = [
    ["cash only", 0, 0, 5000, 500, 4400],
    ["seller reserve", 1000, 0, 4000, 400, 4500],
    ["platform goodwill", 0, 1000, 4000, 400, 4500],
    ["mixed sources", 500, 500, 4000, 400, 4500],
    ["full seller reserve", 5000, 0, 0, 0, 5000],
    ["full platform goodwill", 0, 5000, 0, 0, 5000],
  ];
  for (const [name, seller, platform, cash, fee, payable] of cases) {
    const reserve = cash === 0 ? 0 : 100;
    const result = reconcileOrderFunding({ ...base,
      sellerRedeemedMinor: seller, platformRedeemedMinor: platform,
      redeemedMinor: seller + platform, newCashMinor: cash,
      commissionBaseMinor: cash, commissionMinor: fee,
      newSellerReserveMinor: reserve, sellerPayableMinor: payable });
    assert.equal(result.balanced, true, name);
    assert.equal(result.sellerReserveReleasedNetMinor, seller, name);
    assert.equal(result.platformContributionNetMinor, platform, name);
  }
});

test("shipping is cash-only and a partial mixed-source refund restores each grant bucket", () => {
  const result = reconcileOrderFunding({ ...base,
    merchandiseMinor: 5000, shippingMinor: 500,
    sellerRedeemedMinor: 500, platformRedeemedMinor: 500,
    redeemedMinor: 1000, newCashMinor: 4500,
    commissionBaseMinor: 4000, commissionMinor: 400,
    newSellerReserveMinor: 80, sellerPayableMinor: 5020,
    sellerRestoredMinor: 200, platformRestoredMinor: 200,
    refundedLoyaltyMinor: 400, refundedCashMerchandiseMinor: 1600,
    refundedMerchandiseMinor: 2000, commissionReversedMinor: 160,
    sellerRecoveredMinor: 1824, sellerReserveReversedMinor: 16,
  });
  assert.equal(result.balanced, true);
  assert.equal(result.refundedCashMinor, 1600);
  assert.equal(result.sellerReserveReleasedNetMinor, 300);
  assert.equal(result.platformContributionNetMinor, 300);
  assert.equal(result.commissionNetMinor, 240);
});

test("zero-cash full refund returns original source credit and fully recovers seller proceeds", () => {
  const evidence: OrderFundingEvidence = { ...base,
    sellerRedeemedMinor: 2000, platformRedeemedMinor: 3000,
    redeemedMinor: 5000, newCashMinor: 0, commissionBaseMinor: 0,
    commissionMinor: 0, newSellerReserveMinor: 0, sellerPayableMinor: 5000,
    sellerRestoredMinor: 2000, platformRestoredMinor: 3000,
    refundedMerchandiseMinor: 5000, refundedCashMerchandiseMinor: 0,
    refundedLoyaltyMinor: 5000, sellerRecoveredMinor: 5000,
  };
  const result = reconcileOrderFunding(evidence);
  assert.equal(result.balanced, true);
  assert.equal(result.refundedCashMinor, 0);
  assert.equal(result.sellerReserveReleasedNetMinor, 0);
  assert.equal(result.platformContributionNetMinor, 0);
  assert.equal(result.sellerNetAfterRefundMinor, 0);
  assert.ok(reconcileOrderFunding({ ...evidence, sellerRecoveredMinor: 4999 })
    .violations.includes("FULL_REFUND_SELLER_RECOVERY_MISMATCH"));
});

test("funding-source swaps, fake cash, double restoration and seller payable drift fail closed", () => {
  const seller = { ...base, sellerRedeemedMinor: 1000, redeemedMinor: 1000,
    newCashMinor: 4000, commissionBaseMinor: 4000, commissionMinor: 400,
    sellerPayableMinor: 4500 };
  assert.equal(reconcileOrderFunding(seller).balanced, true);
  assert.ok(reconcileOrderFunding({ ...seller, sellerRedeemedMinor: 0,
    platformRedeemedMinor: 0 }).violations.includes("SOURCE_REDEMPTION_MISMATCH"));
  assert.ok(reconcileOrderFunding({ ...seller, newCashMinor: 5000 }).violations
    .includes("BUYER_FUNDING_MISMATCH"));
  assert.ok(reconcileOrderFunding({ ...seller, sellerRestoredMinor: 1001,
    refundedLoyaltyMinor: 1001, refundedMerchandiseMinor: 1001 })
    .violations.includes("FUNDING_OVERALLOCATION"));
  assert.ok(reconcileOrderFunding({ ...seller, sellerPayableMinor: 4400 }).violations
    .includes("SELLER_PAYABLE_MISMATCH"));
  assert.ok(reconcileOrderFunding({ ...seller, newSellerReserveMinor: 4001 })
    .violations.includes("CASH_ONLY_COMMISSION_RESERVE_VIOLATION"));
});

test("read-only order trace attributes settled allocation by grant and scopes to requested store", async () => {
  let where: unknown;
  const db = { orderGroup: { findMany: async (args: { where: unknown }) => {
    where = args.where;
    return [{ id: "group-a", orderId: "order-a", storeId: "store-a",
      kind: "MARKETPLACE", itemSubtotalMinor: 5000, shippingAmountMinor: 0,
      loyaltyRedeemedMinor: 1000, loyaltyReserveMinor: 80,
      loyaltyReserveReversedMinor: 0, platformFeeAmountMinor: 400,
      commissionReversedMinor: 0, sellerNetAmountMinor: 4520,
      sellerRecoveredMinor: 0, refundedMerchandiseMinor: 0,
      refundedCashMerchandiseMinor: 0, refundedShippingMinor: 0,
      order: { status: "PAID", currency: "EUR", buyerId: "buyer-a",
        loyaltyFundingSnapshot: { status: "LOYALTY_SETTLED" } },
      items: [{ loyaltyRedemptionAllocations: [
        { amountMinor: 600, restoredMinor: 0,
          grant: { fundingSource: "SELLER_RESERVE" } },
        { amountMinor: 400, restoredMinor: 0,
          grant: { fundingSource: "PLATFORM_ADMIN" } },
      ] }], refundAllocations: [] }];
  } } } as unknown as PrismaClient;
  const rows = await orderLoyaltyFundingTrace(db, "order-a", "store-a");
  assert.deepEqual(where, { orderId: "order-a", kind: "MARKETPLACE", storeId: "store-a" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceSettled, true);
  assert.equal(rows[0].reconciliation?.balanced, true);
  assert.equal(rows[0].reconciliation?.sellerReserveReleasedNetMinor, 600);
  assert.equal(rows[0].reconciliation?.platformContributionNetMinor, 400);
});

test("admin order snapshot catches missing euros across checkout groups", async () => {
  const snapshot = { status: "LOYALTY_SETTLED", grossMerchandiseMinor: 7000,
    shippingMinor: 500, newCashMinor: 6500, loyaltyRedeemedMinor: 1000,
    commissionBaseMinor: 6000,
    platformCommissionMinor: 600, sellerPayableMinor: 6800,
    newReserveMinor: 100 };
  const groups = [
    { kind: "MARKETPLACE", itemSubtotalMinor: 5000, shippingAmountMinor: 500,
      loyaltyRedeemedMinor: 1000, platformFeeAmountMinor: 400,
      sellerNetAmountMinor: 5020, loyaltyReserveMinor: 80 },
    { kind: "MARKETPLACE", itemSubtotalMinor: 2000, shippingAmountMinor: 0,
      loyaltyRedeemedMinor: 0, platformFeeAmountMinor: 200,
      sellerNetAmountMinor: 1780, loyaltyReserveMinor: 20 },
  ];
  const db = { order: { findUnique: async () => ({ id: "order-a", status: "PAID",
    currency: "EUR", loyaltyFundingSnapshot: snapshot, groups }) } } as unknown as PrismaClient;
  const valid = await auditOrderLoyaltySnapshot(db, "order-a");
  assert.equal(valid?.balanced, true);
  snapshot.newCashMinor += 1;
  const drift = await auditOrderLoyaltySnapshot(db, "order-a");
  assert.equal(drift?.balanced, false);
  assert.ok(drift?.mismatches.includes("newCashMinor"));
});
