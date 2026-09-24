import { Prisma, type PrismaClient } from "@prisma/client";
import { exactMinorAmount, type SupportedBuyerCurrency } from "./currency";
import { configuredStripeMode, createStripeRefund, createStripeTransferReversal, stripeCheckoutSessionMode, type StripeMode } from "./stripe";
import { loyaltyReserveReversalMinor } from "./loyalty-calculation";
import { restoreRefundedLoyalty, reverseRefundedLoyalty } from "./loyalty-refunds";
import { loyaltyRefundComposition } from "./loyalty-refund-composition";

export const REFUND_CLAIM_MS = 15 * 60_000;
export const REFUND_RETRY_MS = 15 * 60_000;
export const MAX_FINANCIAL_ATTEMPTS = 8;

export class RefundPaymentModeError extends Error {
  readonly code: "REFUND_PAYMENT_MODE_MISMATCH" | "REFUND_PAYMENT_MODE_UNRESOLVED";
  readonly status = 409;
  constructor(code: RefundPaymentModeError["code"], readonly expectedMode: StripeMode, readonly actualMode: StripeMode | null) {
    super(code === "REFUND_PAYMENT_MODE_MISMATCH" ? "The original payment mode does not match the current Stripe mode." : "The original payment mode cannot be determined safely.");
    this.code = code;
  }
}

type PaymentModeOrder = { stripePaymentMode?: string | null; stripeCheckoutSessionId?: string | null };
export function orderPaymentMode(order: PaymentModeOrder): StripeMode | null {
  const stored = order.stripePaymentMode?.toLowerCase();
  if (stored === "test" || stored === "live") return stored;
  return order.stripeCheckoutSessionId ? stripeCheckoutSessionMode(order.stripeCheckoutSessionId) : null;
}

export function assertRefundPaymentMode(order: PaymentModeOrder, runtimeMode = configuredStripeMode()) {
  const paymentMode = orderPaymentMode(order);
  if (!paymentMode) throw new RefundPaymentModeError("REFUND_PAYMENT_MODE_UNRESOLVED", runtimeMode, null);
  if (paymentMode !== runtimeMode) throw new RefundPaymentModeError("REFUND_PAYMENT_MODE_MISMATCH", runtimeMode, paymentMode);
  return paymentMode;
}

export async function assertRefundRequestPaymentMode(db: PrismaClient, refundRequestId: string, runtimeMode = configuredStripeMode()) {
  const request = await db.refundRequest.findUniqueOrThrow({ where: { id: refundRequestId }, select: { order: { select: { id: true, stripePaymentMode: true, stripeCheckoutSessionId: true,
    loyaltyFundingSnapshot: { select: { status: true, newCashMinor: true,
      loyaltyRedeemedMinor: true } } } } } });
  const funding = request.order.loyaltyFundingSnapshot;
  if (funding?.status === "LOYALTY_SETTLED" && funding.newCashMinor === 0 &&
    funding.loyaltyRedeemedMinor > 0)
    return { orderId: request.order.id, paymentMode: null };
  return { orderId: request.order.id, paymentMode: assertRefundPaymentMode(request.order, runtimeMode) };
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Stripe financial operation failed").slice(0, 500);
}

/** Creates the immutable allocation once. The public admin path intentionally requests all remaining lines. */
export async function ensureRefundOperation(db: PrismaClient, refundRequestId: string, actorId: string, options: { returnRequired?: boolean } = {}, now = new Date()) {
  return db.$transaction(async (tx) => {
    const existing = await tx.refundOperation.findUnique({ where: { refundRequestId } });
    if (existing) return existing;
    const request = await tx.refundRequest.findUniqueOrThrow({
      where: { id: refundRequestId },
      include: { order: { include: { loyaltyFundingSnapshot: true, groups: true, items: { include: { refundAllocations: { select: { quantity: true } }, loyaltyGrant: { select: { amountMinor: true, reversedMinor: true } } } } } } },
    });
    if (request.status !== "ADMIN_APPROVED") throw new Error("Refund request is not admin approved.");
    const order = request.order;
    if (!order.paidAt) throw new Error("Order has no authoritative paid status.");
    const zeroCash = order.loyaltyFundingSnapshot?.status === "LOYALTY_SETTLED" &&
      order.loyaltyFundingSnapshot.newCashMinor === 0 &&
      order.loyaltyFundingSnapshot.loyaltyRedeemedMinor > 0;
    if (!zeroCash && !order.stripePaymentIntentId)
      throw new Error("Order has no authoritative paid Stripe PaymentIntent.");
    const paymentMode = zeroCash ? null : assertRefundPaymentMode(order);

    const itemRows = order.items.map((item) => {
      if (!item.orderGroupId) throw new Error("Refundable order line has no authoritative order group.");
      const already = item.refundAllocations.reduce((sum, row) => sum + row.quantity, 0);
      const quantity = item.quantity - already;
      const unitAmountMinor = exactMinorAmount(item.unitPrice, order.currency as SupportedBuyerCurrency);
      const funding = loyaltyRefundComposition({ quantity: item.quantity,
        unitGrossMinor: unitAmountMinor, redeemedMinor: item.loyaltyRedeemedMinor ?? 0,
        previouslyRefundedQuantity: already, newlyRefundedQuantity: quantity });
      const itemReserveReversalMinor = item.loyaltyGrant
        ? loyaltyReserveReversalMinor({ grantMinor: item.loyaltyGrant.amountMinor,
          originalQuantity: item.quantity, cumulativeRefundedQuantity: already + quantity,
          previouslyReversedMinor: item.loyaltyGrant.reversedMinor }) : 0;
      return { item, quantity, unitAmountMinor,
        merchandiseAmountMinor: funding.grossRefundMinor,
        cashAmountMinor: funding.cashRefundMinor,
        loyaltyRestoredMinor: funding.loyaltyRestoredMinor,
        loyaltyReserveReversalMinor: itemReserveReversalMinor };
    }).filter((row) => row.quantity > 0);
    if (!itemRows.length) throw new Error("Order has no refundable quantity remaining.");

    const groupRows = order.groups.map((group) => {
      const rows = itemRows.filter((row) => row.item.orderGroupId === group.id);
      const merchandiseAmountMinor = rows.reduce((sum, row) => sum + row.merchandiseAmountMinor, 0);
      if (!merchandiseAmountMinor) return null;
      const cashMerchandiseMinor = rows.reduce((sum, row) => sum + row.cashAmountMinor, 0);
      const loyaltyRestoredMinor = rows.reduce((sum, row) => sum + row.loyaltyRestoredMinor, 0);
      const previousMerchandise = group.refundedMerchandiseMinor;
      const cumulativeMerchandise = Math.min(group.itemSubtotalMinor, previousMerchandise + merchandiseAmountMinor);
      const commissionBaseMinor = group.itemSubtotalMinor - (group.loyaltyRedeemedMinor ?? 0);
      const cumulativeCash = Math.min(commissionBaseMinor,
        ((group.loyaltyRedeemedMinor ?? 0) > 0
          ? group.refundedCashMerchandiseMinor
          : group.refundedMerchandiseMinor) + cashMerchandiseMinor);
      const cumulativeCommission = commissionBaseMinor > 0
        ? Math.min(group.platformFeeAmountMinor, Math.floor(group.platformFeeAmountMinor * cumulativeCash / commissionBaseMinor))
        : 0;
      const commissionReversalMinor = Math.max(0, cumulativeCommission - group.commissionReversedMinor);
      const reserveReversalMinor = rows.reduce((sum, row) => sum + row.loyaltyReserveReversalMinor, 0);
      const shippingAmountMinor = cumulativeMerchandise === group.itemSubtotalMinor ? Math.max(0, group.shippingAmountMinor - group.refundedShippingMinor) : 0;
      const sellerRecoveryMinor = group.kind === "MARKETPLACE"
        ? Math.min(Math.max(0, group.sellerNetAmountMinor - group.sellerRecoveredMinor), merchandiseAmountMinor + shippingAmountMinor - commissionReversalMinor - reserveReversalMinor)
        : 0;
      return { group, merchandiseAmountMinor, cashMerchandiseMinor,
        loyaltyRestoredMinor, shippingAmountMinor, commissionReversalMinor,
        loyaltyReserveReversalMinor: reserveReversalMinor, sellerRecoveryMinor };
    }).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const merchandiseAmountMinor = groupRows.reduce((sum, row) => sum + row.merchandiseAmountMinor, 0);
    const cashMerchandiseMinor = groupRows.reduce((sum, row) => sum + row.cashMerchandiseMinor, 0);
    const loyaltyRestoredMinor = groupRows.reduce((sum, row) => sum + row.loyaltyRestoredMinor, 0);
    const shippingAmountMinor = groupRows.reduce((sum, row) => sum + row.shippingAmountMinor, 0);
    const operation = await tx.refundOperation.create({ data: {
      refundRequestId, orderId: order.id, buyerId: request.buyerId, currency: order.currency,
      status: "APPROVED", reason: request.reason, returnRequired: options.returnRequired === true, paymentMode: paymentMode?.toUpperCase() ?? null, refundIdempotencyKey: `buyer-refund:${refundRequestId}`,
      merchandiseAmountMinor, cashMerchandiseMinor, loyaltyRestoredMinor,
      shippingAmountMinor, totalAmountMinor: cashMerchandiseMinor + shippingAmountMinor,
      reviewedById: actorId, reviewedAt: now,
      itemAllocations: { create: itemRows.map((row) => ({ orderItemId: row.item.id, quantity: row.quantity, unitAmountMinor: row.unitAmountMinor, merchandiseAmountMinor: row.merchandiseAmountMinor, cashAmountMinor: row.cashAmountMinor, loyaltyRestoredMinor: row.loyaltyRestoredMinor })) },
      groupAllocations: { create: groupRows.map((row) => ({ orderGroupId: row.group.id, merchandiseAmountMinor: row.merchandiseAmountMinor, cashMerchandiseMinor: row.cashMerchandiseMinor, loyaltyRestoredMinor: row.loyaltyRestoredMinor, shippingAmountMinor: row.shippingAmountMinor, commissionReversalMinor: row.commissionReversalMinor, loyaltyReserveReversalMinor: row.loyaltyReserveReversalMinor, sellerRecoveryMinor: row.sellerRecoveryMinor, shippingRefundReason: row.shippingAmountMinor ? "FULL_GROUP_REFUND" : null })) },
    } });
    await tx.orderLifecycleEvent.create({ data: { orderId: order.id, type: "BUYER_REFUND_APPROVED", actorId, createdAt: now, metadata: { refundOperationId: operation.id, refundRequestId, totalAmountMinor: operation.totalAmountMinor, currency: order.currency } } });
    return operation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

type RefundWithGroups = Prisma.RefundOperationGetPayload<{ include: {
  order: { select: { stripePaymentIntentId: true; loyaltyFundingSnapshot: true } };
  groupAllocations: { include: { orderGroup: true } };
} }>;

/** A provider refund and a zero-cash ledger refund share this one immutable
 * finalization path. A null provider ID is legal only for a confirmed
 * zero-cash loyalty order; the caller validates that before entering. */
async function finalizeRefundOperation(db: PrismaClient, operation: RefundWithGroups,
  providerRefundId: string | null, now: Date) {
  // Operations approved before the additive loyalty migration have zeroed
  // cash-composition columns. They had no loyalty funding, so their original
  // gross merchandise amount was entirely cash. Preserve in-flight refunds.
  const legacyCashOnly = !operation.order.loyaltyFundingSnapshot &&
    operation.cashMerchandiseMinor === 0 && operation.loyaltyRestoredMinor === 0 &&
    operation.merchandiseAmountMinor > 0;
  const cashMerchandiseMinor = legacyCashOnly
    ? operation.merchandiseAmountMinor : operation.cashMerchandiseMinor;
  if (operation.groupAllocations.reduce((sum, allocation) =>
    sum + allocation.loyaltyRestoredMinor, 0) !== operation.loyaltyRestoredMinor ||
    cashMerchandiseMinor + operation.shippingAmountMinor !== operation.totalAmountMinor ||
    operation.merchandiseAmountMinor !== cashMerchandiseMinor + operation.loyaltyRestoredMinor)
    throw new Error("LOYALTY_REFUND_COMPOSITION_MISMATCH");
  await db.$transaction(async (tx) => {
    const finalized = await tx.refundOperation.updateMany({ where: {
      id: operation.id, status: "PROCESSING", stripeRefundId: null,
    }, data: { status: "COMPLETED", stripeRefundId: providerRefundId,
      nextAttemptAt: null, errorCode: null, errorMessage: null } });
    if (finalized.count !== 1) return;
    await tx.refundGroupAllocation.updateMany({ where: { refundOperationId: operation.id },
      data: { status: "COMPLETED" } });
    const expectedReserveReversal = operation.groupAllocations.reduce((sum, item) =>
      sum + item.loyaltyReserveReversalMinor, 0);
    if (expectedReserveReversal > 0 && await reverseRefundedLoyalty(tx,
      operation.id, operation.orderId) !== expectedReserveReversal)
      throw new Error("LOYALTY_EARNING_REFUND_MISMATCH");
    if (operation.loyaltyRestoredMinor > 0 && await restoreRefundedLoyalty(tx,
      operation.id, operation.orderId, now) !== operation.loyaltyRestoredMinor)
      throw new Error("LOYALTY_REDEMPTION_REFUND_MISMATCH");
    const itemAllocations = await tx.refundItemAllocation.findMany({
      where: { refundOperationId: operation.id },
      include: { orderItem: { select: { orderGroup: { select: { kind: true } } } } },
    });
    for (const item of itemAllocations) {
      const returnApplicable = operation.returnRequired &&
        item.orderItem.orderGroup?.kind === "MARKETPLACE";
      await tx.inventoryRestockEvent.upsert({
        where: { lifecycleKey: `return:${operation.id}:${item.orderItemId}` }, update: {},
        create: { refundOperationId: operation.id, orderItemId: item.orderItemId,
          quantity: item.quantity,
          status: returnApplicable ? "AWAITING_RETURN" : "NOT_APPLICABLE",
          reason: returnApplicable ? "RETURN_REQUIRED" : operation.returnRequired
            ? "CJ_PLATFORM_MANUAL" : "RETURN_NOT_REQUIRED",
          lifecycleKey: `return:${operation.id}:${item.orderItemId}`,
          idempotencyKey: `return:${operation.id}:${item.orderItemId}` },
      });
    }
    for (const allocation of operation.groupAllocations) {
      await tx.orderGroup.update({ where: { id: allocation.orderGroupId }, data: {
        refundedMerchandiseMinor: { increment: allocation.merchandiseAmountMinor },
        refundedCashMerchandiseMinor: { increment: legacyCashOnly
          ? allocation.merchandiseAmountMinor : allocation.cashMerchandiseMinor },
        refundedShippingMinor: { increment: allocation.shippingAmountMinor },
        commissionReversedMinor: { increment: allocation.commissionReversalMinor },
        loyaltyReserveReversedMinor: { increment: allocation.loyaltyReserveReversalMinor },
        sellerRecoveredMinor: { increment: allocation.sellerRecoveryMinor },
      } });
      if (allocation.orderGroup.kind === "MARKETPLACE" &&
        allocation.sellerRecoveryMinor > 0 && allocation.orderGroup.stripeTransferId) {
        await tx.transferReversal.upsert({
          where: { refundGroupAllocationId_orderGroupId: {
            refundGroupAllocationId: allocation.id, orderGroupId: allocation.orderGroupId } },
          update: {}, create: { orderGroupId: allocation.orderGroupId,
            refundGroupAllocationId: allocation.id, amountMinor: allocation.sellerRecoveryMinor,
            currency: operation.currency,
            originalStripeTransferId: allocation.orderGroup.stripeTransferId,
            idempotencyKey: `seller-reversal:${allocation.id}` },
        });
      }
    }
    await tx.orderLifecycleEvent.create({ data: { orderId: operation.orderId,
      type: "BUYER_REFUND_COMPLETED", actorId: operation.reviewedById, createdAt: now,
      metadata: { refundOperationId: operation.id, stripeRefundId: providerRefundId,
        cashRefundMinor: operation.totalAmountMinor,
        loyaltyRestoredMinor: operation.loyaltyRestoredMinor,
        currency: operation.currency } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function processRefundOperation(db: PrismaClient, operationId: string, now = new Date(), submit = createStripeRefund) {
  const context = await db.refundOperation.findUniqueOrThrow({ where: { id: operationId }, select: { paymentMode: true, totalAmountMinor: true, order: { select: { stripePaymentMode: true, stripeCheckoutSessionId: true,
    loyaltyFundingSnapshot: { select: { status: true, newCashMinor: true,
      loyaltyRedeemedMinor: true } } } } } });
  const runtimeMode = configuredStripeMode();
  const zeroCash = context.totalAmountMinor === 0 &&
    context.order.loyaltyFundingSnapshot?.status === "LOYALTY_SETTLED" &&
    context.order.loyaltyFundingSnapshot.newCashMinor === 0 &&
    context.order.loyaltyFundingSnapshot.loyaltyRedeemedMinor > 0;
  try {
    if (!zeroCash) {
      const paymentMode = assertRefundPaymentMode(context.order, runtimeMode);
      if (context.paymentMode && context.paymentMode.toLowerCase() !== paymentMode)
        throw new RefundPaymentModeError("REFUND_PAYMENT_MODE_MISMATCH", runtimeMode,
          context.paymentMode.toLowerCase() as StripeMode);
    } else if (context.paymentMode) throw new Error("Zero-cash loyalty refund has an unexpected payment mode.");
  } catch (error) {
    if (error instanceof RefundPaymentModeError) await db.refundOperation.updateMany({ where: { id: operationId, stripeRefundId: null }, data: { status: "MANUAL_ACTION_REQUIRED", nextAttemptAt: null, errorCode: error.code, errorMessage: error.message } });
    throw error;
  }
  const claimed = await db.refundOperation.updateMany({ where: { id: operationId, status: { in: ["APPROVED", "RETRYABLE"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }], stripeRefundId: null }, data: { status: "PROCESSING", attemptCount: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + REFUND_CLAIM_MS), errorCode: null, errorMessage: null } });
  if (claimed.count !== 1) return { idempotent: true };
  const operation = await db.refundOperation.findUniqueOrThrow({ where: { id: operationId }, include: { order: { select: { stripePaymentIntentId: true, loyaltyFundingSnapshot: true } }, groupAllocations: { include: { orderGroup: true } } } });
  try {
    if (zeroCash) {
      if (operation.totalAmountMinor !== 0 || operation.order.stripePaymentIntentId ||
        operation.loyaltyRestoredMinor <= 0)
        throw new Error("Zero-cash loyalty refund composition is invalid.");
      await finalizeRefundOperation(db, operation, null, now);
      return { fundedRefund: true, id: operation.id };
    }
    if (!operation.order.stripePaymentIntentId) throw new Error("Paid order PaymentIntent is missing.");
    const refund = await submit({ paymentIntentId: operation.order.stripePaymentIntentId, amount: operation.totalAmountMinor, idempotencyKey: operation.refundIdempotencyKey });
    await finalizeRefundOperation(db, operation, refund.id, now);
    return { refunded: true, id: refund.id };
  } catch (error) {
    const exhausted = operation.attemptCount >= MAX_FINANCIAL_ATTEMPTS;
    await db.refundOperation.updateMany({ where: { id: operation.id, status: "PROCESSING", stripeRefundId: null }, data: { status: exhausted ? "MANUAL_ACTION_REQUIRED" : "RETRYABLE", nextAttemptAt: exhausted ? null : new Date(now.getTime() + REFUND_RETRY_MS), errorCode: "BUYER_REFUND_FAILED", errorMessage: safeMessage(error) } });
    throw error;
  }
}

/** Materializes reversals after a concurrent Stage 2 transfer is durably reconciled. */
export async function reconcileTransferredRefunds(db: PrismaClient) {
  const allocations = await db.refundGroupAllocation.findMany({ where: { status: "COMPLETED", sellerRecoveryMinor: { gt: 0 }, orderGroup: { kind: "MARKETPLACE", transferStatus: "TRANSFERRED", stripeTransferId: { not: null } }, transferReversals: { none: {} } }, include: { refundOperation: { select: { currency: true } }, orderGroup: { select: { stripeTransferId: true } } }, take: 100 });
  for (const allocation of allocations) await db.transferReversal.upsert({ where: { refundGroupAllocationId_orderGroupId: { refundGroupAllocationId: allocation.id, orderGroupId: allocation.orderGroupId } }, update: {}, create: { orderGroupId: allocation.orderGroupId, refundGroupAllocationId: allocation.id, amountMinor: allocation.sellerRecoveryMinor, currency: allocation.refundOperation.currency, originalStripeTransferId: allocation.orderGroup.stripeTransferId!, idempotencyKey: `seller-reversal:${allocation.id}` } });
}

export async function processTransferReversal(db: PrismaClient, reversalId: string, now = new Date(), submit = createStripeTransferReversal) {
  const claimed = await db.transferReversal.updateMany({ where: { id: reversalId, status: { in: ["REQUESTED", "RETRYABLE"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }], stripeReversalId: null }, data: { status: "PROCESSING", attemptCount: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + REFUND_CLAIM_MS), errorCode: null, errorMessage: null } });
  if (claimed.count !== 1) return { idempotent: true };
  const reversal = await db.transferReversal.findUniqueOrThrow({ where: { id: reversalId }, include: { refundGroupAllocation: { include: { refundOperation: true } } } });
  try {
    if (!reversal.originalStripeTransferId || reversal.originalStripeTransferId === "historical-unresolved") throw new Error("Original Stripe transfer is unavailable for automatic reversal.");
    const result = await submit({ transferId: reversal.originalStripeTransferId, amount: reversal.amountMinor, idempotencyKey: reversal.idempotencyKey });
    await db.$transaction(async (tx) => {
      const finalized = await tx.transferReversal.updateMany({ where: { id: reversal.id, status: "PROCESSING", stripeReversalId: null }, data: { status: "COMPLETED", stripeReversalId: result.id, nextAttemptAt: null, errorCode: null, errorMessage: null } });
      if (finalized.count !== 1) return;
      await tx.orderLifecycleEvent.create({ data: { orderId: reversal.refundGroupAllocation.refundOperation.orderId, type: "SELLER_TRANSFER_REVERSAL_COMPLETED", createdAt: now, metadata: { refundOperationId: reversal.refundGroupAllocation.refundOperationId, orderGroupId: reversal.orderGroupId, originalStripeTransferId: reversal.originalStripeTransferId, stripeReversalId: result.id, amountMinor: reversal.amountMinor, currency: reversal.currency } } });
    });
    return { reversed: true, id: result.id };
  } catch (error) {
    const exhausted = reversal.attemptCount >= MAX_FINANCIAL_ATTEMPTS;
    await db.transferReversal.updateMany({ where: { id: reversal.id, status: "PROCESSING", stripeReversalId: null }, data: { status: exhausted ? "MANUAL_ACTION_REQUIRED" : "RETRYABLE", nextAttemptAt: exhausted ? null : new Date(now.getTime() + REFUND_RETRY_MS), errorCode: "TRANSFER_REVERSAL_FAILED", errorMessage: safeMessage(error) } });
    throw error;
  }
}

export async function processDueRefundFinancials(db: PrismaClient, now = new Date()) {
  await db.refundOperation.updateMany({ where: { status: "PROCESSING", nextAttemptAt: { lte: now }, stripeRefundId: null }, data: { status: "RETRYABLE", nextAttemptAt: now, errorCode: "STALE_REFUND_CLAIM_RECOVERED", errorMessage: "A stale refund claim was recovered for idempotent retry." } });
  await db.transferReversal.updateMany({ where: { status: "PROCESSING", nextAttemptAt: { lte: now }, stripeReversalId: null }, data: { status: "RETRYABLE", nextAttemptAt: now, errorCode: "STALE_REVERSAL_CLAIM_RECOVERED", errorMessage: "A stale reversal claim was recovered for idempotent retry." } });
  await reconcileTransferredRefunds(db);
  const refunds = await db.refundOperation.findMany({ where: { status: { in: ["APPROVED", "RETRYABLE"] }, stripeRefundId: null, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, take: 25, select: { id: true } });
  const reversals = await db.transferReversal.findMany({ where: { status: { in: ["REQUESTED", "RETRYABLE"] }, stripeReversalId: null, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, take: 25, select: { id: true } });
  const results = [];
  for (const row of refunds) try { results.push(await processRefundOperation(db, row.id, now)); } catch (error) { results.push({ error: safeMessage(error) }); }
  for (const row of reversals) try { results.push(await processTransferReversal(db, row.id, now)); } catch (error) { results.push({ error: safeMessage(error) }); }
  return { processed: results.length, results };
}
