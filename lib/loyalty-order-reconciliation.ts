import { LoyaltyFundingSource, type PrismaClient } from "@prisma/client";

type Source = typeof LoyaltyFundingSource.SELLER_RESERVE |
  typeof LoyaltyFundingSource.PLATFORM_ADMIN;

export type OrderFundingEvidence = {
  merchandiseMinor: number; shippingMinor: number;
  redeemedMinor: number; sellerRedeemedMinor: number;
  platformRedeemedMinor: number; sellerRestoredMinor: number;
  platformRestoredMinor: number; newCashMinor: number;
  commissionBaseMinor: number; commissionMinor: number;
  newSellerReserveMinor: number; sellerPayableMinor: number;
  refundedMerchandiseMinor: number; refundedCashMerchandiseMinor: number;
  refundedShippingMinor: number; refundedLoyaltyMinor: number;
  commissionReversedMinor: number; sellerRecoveredMinor: number;
  sellerReserveReversedMinor: number;
};

/** Pure, exact-minor conservation proof for one store/order group. Grant
 * attribution is required: aggregate redeemed credit alone cannot prove
 * whether the seller reserve or Todijo treasury funded this order. */
export function reconcileOrderFunding(input: OrderFundingEvidence) {
  if (Object.values(input).some(value => !Number.isSafeInteger(value) || value < 0))
    throw new RangeError("INVALID_ORDER_FUNDING_EVIDENCE");
  const sourceRedeemedMinor = input.sellerRedeemedMinor + input.platformRedeemedMinor;
  const sourceRestoredMinor = input.sellerRestoredMinor + input.platformRestoredMinor;
  const grossMinor = input.merchandiseMinor + input.shippingMinor;
  const sellerNetAfterRefundMinor = input.sellerPayableMinor - input.sellerRecoveredMinor;
  const commissionNetMinor = input.commissionMinor - input.commissionReversedMinor;
  const sellerReserveNetMinor = input.newSellerReserveMinor - input.sellerReserveReversedMinor;
  const refundedCashMinor = input.refundedCashMerchandiseMinor + input.refundedShippingMinor;
  const violations: string[] = [];
  if (sourceRedeemedMinor !== input.redeemedMinor) violations.push("SOURCE_REDEMPTION_MISMATCH");
  if (sourceRestoredMinor !== input.refundedLoyaltyMinor) violations.push("SOURCE_RESTORATION_MISMATCH");
  if (grossMinor !== input.newCashMinor + sourceRedeemedMinor) violations.push("BUYER_FUNDING_MISMATCH");
  if (input.commissionBaseMinor !== input.merchandiseMinor - sourceRedeemedMinor)
    violations.push("COMMISSION_BASE_MISMATCH");
  if (input.sellerPayableMinor !== grossMinor - input.commissionMinor - input.newSellerReserveMinor)
    violations.push("SELLER_PAYABLE_MISMATCH");
  if (input.newSellerReserveMinor > input.commissionBaseMinor ||
    input.commissionMinor > input.commissionBaseMinor)
    violations.push("CASH_ONLY_COMMISSION_RESERVE_VIOLATION");
  if (input.refundedMerchandiseMinor !== input.refundedCashMerchandiseMinor + sourceRestoredMinor)
    violations.push("REFUND_FUNDING_MISMATCH");
  if (input.refundedMerchandiseMinor === input.merchandiseMinor &&
    input.refundedShippingMinor === input.shippingMinor &&
    input.sellerRecoveredMinor !== input.sellerPayableMinor)
    violations.push("FULL_REFUND_SELLER_RECOVERY_MISMATCH");
  if (input.redeemedMinor > input.merchandiseMinor ||
    sourceRestoredMinor > sourceRedeemedMinor || refundedCashMinor > input.newCashMinor ||
    input.refundedMerchandiseMinor > input.merchandiseMinor ||
    input.commissionReversedMinor > input.commissionMinor ||
    input.sellerReserveReversedMinor > input.newSellerReserveMinor ||
    input.sellerRecoveredMinor > input.refundedMerchandiseMinor +
      input.refundedShippingMinor - input.commissionReversedMinor -
      input.sellerReserveReversedMinor ||
    sellerNetAfterRefundMinor < 0 || commissionNetMinor < 0 || sellerReserveNetMinor < 0)
    violations.push("FUNDING_OVERALLOCATION");
  return { ...input, grossMinor, sellerNetAfterRefundMinor, commissionNetMinor,
    sellerReserveNetMinor, refundedCashMinor,
    sellerReserveReleasedNetMinor: input.sellerRedeemedMinor - input.sellerRestoredMinor,
    platformContributionNetMinor: input.platformRedeemedMinor - input.platformRestoredMinor,
    balanced: violations.length === 0, violations };
}

/** Read-only order trace. A pending checkout has not consumed its grants yet;
 * it is explicitly marked unverified rather than assigning fake source cash. */
export async function orderLoyaltyFundingTrace(db: PrismaClient, orderId: string,
  storeId?: string) {
  const groups = await db.orderGroup.findMany({ where: { orderId, kind: "MARKETPLACE",
    ...(storeId ? { storeId } : {}) }, select: {
    id: true, storeId: true, kind: true, orderId: true,
    itemSubtotalMinor: true, shippingAmountMinor: true,
    loyaltyRedeemedMinor: true, loyaltyReserveMinor: true,
    loyaltyReserveReversedMinor: true, platformFeeAmountMinor: true,
    commissionReversedMinor: true, sellerNetAmountMinor: true,
    sellerRecoveredMinor: true, refundedMerchandiseMinor: true,
    refundedCashMerchandiseMinor: true, refundedShippingMinor: true,
    order: { select: { status: true, currency: true, buyerId: true,
      loyaltyFundingSnapshot: { select: { status: true } } } },
    items: { select: { loyaltyRedemptionAllocations: { select: {
      amountMinor: true, restoredMinor: true,
      grant: { select: { fundingSource: true } },
    } } } },
    refundAllocations: { where: { status: "COMPLETED" }, select: {
      loyaltyRestoredMinor: true,
    } },
  } });
  return groups.map(group => {
    const allocations = group.items.flatMap(item => item.loyaltyRedemptionAllocations);
    const source = (kind: Source, key: "amountMinor" | "restoredMinor") =>
      allocations.filter(allocation => allocation.grant.fundingSource === kind)
        .reduce((sum, allocation) => sum + allocation[key], 0);
    const sellerRedeemedMinor = source(LoyaltyFundingSource.SELLER_RESERVE, "amountMinor");
    const platformRedeemedMinor = source(LoyaltyFundingSource.PLATFORM_ADMIN, "amountMinor");
    const sellerRestoredMinor = source(LoyaltyFundingSource.SELLER_RESERVE, "restoredMinor");
    const platformRestoredMinor = source(LoyaltyFundingSource.PLATFORM_ADMIN, "restoredMinor");
    const evidence: OrderFundingEvidence = {
      merchandiseMinor: group.itemSubtotalMinor,
      shippingMinor: group.shippingAmountMinor,
      redeemedMinor: group.loyaltyRedeemedMinor,
      sellerRedeemedMinor, platformRedeemedMinor,
      sellerRestoredMinor, platformRestoredMinor,
      newCashMinor: group.itemSubtotalMinor + group.shippingAmountMinor - group.loyaltyRedeemedMinor,
      commissionBaseMinor: group.itemSubtotalMinor - group.loyaltyRedeemedMinor,
      commissionMinor: group.platformFeeAmountMinor,
      newSellerReserveMinor: group.loyaltyReserveMinor,
      sellerPayableMinor: group.sellerNetAmountMinor,
      refundedMerchandiseMinor: group.refundedMerchandiseMinor,
      refundedCashMerchandiseMinor: group.refundedCashMerchandiseMinor,
      refundedShippingMinor: group.refundedShippingMinor,
      refundedLoyaltyMinor: group.refundAllocations.reduce((sum, row) =>
        sum + row.loyaltyRestoredMinor, 0),
      commissionReversedMinor: group.commissionReversedMinor,
      sellerRecoveredMinor: group.sellerRecoveredMinor,
      sellerReserveReversedMinor: group.loyaltyReserveReversedMinor,
    };
    const sourceSettled = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"]
      .includes(group.order.status);
    return { orderId: group.orderId, groupId: group.id, storeId: group.storeId,
      kind: group.kind, currency: group.order.currency,
      buyerId: group.order.buyerId, orderStatus: group.order.status,
      fundingStatus: group.order.loyaltyFundingSnapshot?.status ?? null,
      sourceSettled, reconciliation: sourceSettled
        ? reconcileOrderFunding(evidence) : null };
  });
}

/** Full-order checkout snapshot comparison, deliberately admin-only at the
 * caller. Seller-scoped traces must not disclose another store's figures. */
export async function auditOrderLoyaltySnapshot(db: PrismaClient, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: {
    id: true, status: true, currency: true,
    loyaltyFundingSnapshot: { select: {
      status: true, grossMerchandiseMinor: true, shippingMinor: true,
      newCashMinor: true, loyaltyRedeemedMinor: true,
      commissionBaseMinor: true,
      platformCommissionMinor: true, sellerPayableMinor: true,
      newReserveMinor: true,
    } },
    groups: { select: { kind: true, itemSubtotalMinor: true, shippingAmountMinor: true,
      loyaltyRedeemedMinor: true, platformFeeAmountMinor: true,
      sellerNetAmountMinor: true, loyaltyReserveMinor: true } },
  } });
  if (!order) return null;
  const snapshot = order.loyaltyFundingSnapshot;
  if (!snapshot) return { orderId, status: order.status, snapshot: null,
    balanced: false, mismatches: ["LOYALTY_SNAPSHOT_MISSING"] };
  type NumericGroupKey = Exclude<keyof typeof order.groups[number], "kind">;
  const sum = (key: NumericGroupKey) => order.groups.reduce(
    (total, group) => total + group[key], 0);
  const expected = {
    grossMerchandiseMinor: sum("itemSubtotalMinor"),
    shippingMinor: sum("shippingAmountMinor"),
    loyaltyRedeemedMinor: sum("loyaltyRedeemedMinor"),
    commissionBaseMinor: order.groups.filter(group => group.kind === "MARKETPLACE")
      .reduce((total, group) => total + group.itemSubtotalMinor -
        group.loyaltyRedeemedMinor, 0),
    platformCommissionMinor: sum("platformFeeAmountMinor"),
    sellerPayableMinor: sum("sellerNetAmountMinor"),
    newReserveMinor: sum("loyaltyReserveMinor"),
  };
  const mismatches = Object.entries(expected).flatMap(([key, value]) =>
    snapshot[key as keyof typeof expected] === value ? [] : [key]);
  if (snapshot.newCashMinor !== expected.grossMerchandiseMinor +
    expected.shippingMinor - expected.loyaltyRedeemedMinor)
    mismatches.push("newCashMinor");
  if (snapshot.newCashMinor < 0 || snapshot.loyaltyRedeemedMinor >
    snapshot.grossMerchandiseMinor)
    mismatches.push("INVALID_BUYER_FUNDING");
  return { orderId, status: order.status, currency: order.currency,
    fundingStatus: snapshot.status, snapshot, groupTotals: expected,
    balanced: mismatches.length === 0, mismatches };
}
