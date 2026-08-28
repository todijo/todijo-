import { Prisma, type PrismaClient } from "@prisma/client";
import { exactMinorAmount, type SupportedBuyerCurrency } from "./currency";
import { configuredStripeMode, createStripeRefund, createStripeTransferReversal, stripeCheckoutSessionMode, type StripeMode } from "./stripe";

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
  const request = await db.refundRequest.findUniqueOrThrow({ where: { id: refundRequestId }, select: { order: { select: { id: true, stripePaymentMode: true, stripeCheckoutSessionId: true } } } });
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
      include: { order: { include: { groups: true, items: { include: { refundAllocations: { select: { quantity: true } } } } } } },
    });
    if (request.status !== "ADMIN_APPROVED") throw new Error("Refund request is not admin approved.");
    const order = request.order;
    if (!order.stripePaymentIntentId || !order.paidAt) throw new Error("Order has no authoritative paid Stripe PaymentIntent.");
    const paymentMode = assertRefundPaymentMode(order);

    const itemRows = order.items.map((item) => {
      if (!item.orderGroupId) throw new Error("Refundable order line has no authoritative order group.");
      const already = item.refundAllocations.reduce((sum, row) => sum + row.quantity, 0);
      const quantity = item.quantity - already;
      const unitAmountMinor = exactMinorAmount(item.unitPrice, order.currency as SupportedBuyerCurrency);
      return { item, quantity, unitAmountMinor, merchandiseAmountMinor: unitAmountMinor * quantity };
    }).filter((row) => row.quantity > 0);
    if (!itemRows.length) throw new Error("Order has no refundable quantity remaining.");

    const groupRows = order.groups.map((group) => {
      const rows = itemRows.filter((row) => row.item.orderGroupId === group.id);
      const merchandiseAmountMinor = rows.reduce((sum, row) => sum + row.merchandiseAmountMinor, 0);
      if (!merchandiseAmountMinor) return null;
      const previousMerchandise = group.refundedMerchandiseMinor;
      const cumulativeMerchandise = Math.min(group.itemSubtotalMinor, previousMerchandise + merchandiseAmountMinor);
      const cumulativeCommission = group.itemSubtotalMinor > 0
        ? Math.min(group.platformFeeAmountMinor, Math.floor(group.platformFeeAmountMinor * cumulativeMerchandise / group.itemSubtotalMinor))
        : 0;
      const commissionReversalMinor = Math.max(0, cumulativeCommission - group.commissionReversedMinor);
      const shippingAmountMinor = cumulativeMerchandise === group.itemSubtotalMinor ? Math.max(0, group.shippingAmountMinor - group.refundedShippingMinor) : 0;
      const sellerRecoveryMinor = group.kind === "MARKETPLACE"
        ? Math.min(Math.max(0, group.sellerNetAmountMinor - group.sellerRecoveredMinor), merchandiseAmountMinor + shippingAmountMinor - commissionReversalMinor)
        : 0;
      return { group, merchandiseAmountMinor, shippingAmountMinor, commissionReversalMinor, sellerRecoveryMinor };
    }).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const merchandiseAmountMinor = groupRows.reduce((sum, row) => sum + row.merchandiseAmountMinor, 0);
    const shippingAmountMinor = groupRows.reduce((sum, row) => sum + row.shippingAmountMinor, 0);
    const operation = await tx.refundOperation.create({ data: {
      refundRequestId, orderId: order.id, buyerId: request.buyerId, currency: order.currency,
      status: "APPROVED", reason: request.reason, returnRequired: options.returnRequired === true, paymentMode: paymentMode.toUpperCase(), refundIdempotencyKey: `buyer-refund:${refundRequestId}`,
      merchandiseAmountMinor, shippingAmountMinor, totalAmountMinor: merchandiseAmountMinor + shippingAmountMinor,
      reviewedById: actorId, reviewedAt: now,
      itemAllocations: { create: itemRows.map((row) => ({ orderItemId: row.item.id, quantity: row.quantity, unitAmountMinor: row.unitAmountMinor, merchandiseAmountMinor: row.merchandiseAmountMinor })) },
      groupAllocations: { create: groupRows.map((row) => ({ orderGroupId: row.group.id, merchandiseAmountMinor: row.merchandiseAmountMinor, shippingAmountMinor: row.shippingAmountMinor, commissionReversalMinor: row.commissionReversalMinor, sellerRecoveryMinor: row.sellerRecoveryMinor, shippingRefundReason: row.shippingAmountMinor ? "FULL_GROUP_REFUND" : null })) },
    } });
    await tx.orderLifecycleEvent.create({ data: { orderId: order.id, type: "BUYER_REFUND_APPROVED", actorId, createdAt: now, metadata: { refundOperationId: operation.id, refundRequestId, totalAmountMinor: operation.totalAmountMinor, currency: order.currency } } });
    return operation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function processRefundOperation(db: PrismaClient, operationId: string, now = new Date(), submit = createStripeRefund) {
  const context = await db.refundOperation.findUniqueOrThrow({ where: { id: operationId }, select: { paymentMode: true, order: { select: { stripePaymentMode: true, stripeCheckoutSessionId: true } } } });
  const runtimeMode = configuredStripeMode();
  let paymentMode: StripeMode;
  try {
    paymentMode = assertRefundPaymentMode(context.order, runtimeMode);
    if (context.paymentMode && context.paymentMode.toLowerCase() !== paymentMode) throw new RefundPaymentModeError("REFUND_PAYMENT_MODE_MISMATCH", runtimeMode, context.paymentMode.toLowerCase() as StripeMode);
  } catch (error) {
    if (error instanceof RefundPaymentModeError) await db.refundOperation.updateMany({ where: { id: operationId, stripeRefundId: null }, data: { status: "MANUAL_ACTION_REQUIRED", nextAttemptAt: null, errorCode: error.code, errorMessage: error.message } });
    throw error;
  }
  const claimed = await db.refundOperation.updateMany({ where: { id: operationId, status: { in: ["APPROVED", "RETRYABLE"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }], stripeRefundId: null }, data: { status: "PROCESSING", attemptCount: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + REFUND_CLAIM_MS), errorCode: null, errorMessage: null } });
  if (claimed.count !== 1) return { idempotent: true };
  const operation = await db.refundOperation.findUniqueOrThrow({ where: { id: operationId }, include: { order: { select: { stripePaymentIntentId: true } }, groupAllocations: { include: { orderGroup: true } } } });
  try {
    if (!operation.order.stripePaymentIntentId) throw new Error("Paid order PaymentIntent is missing.");
    const refund = await submit({ paymentIntentId: operation.order.stripePaymentIntentId, amount: operation.totalAmountMinor, idempotencyKey: operation.refundIdempotencyKey });
    await db.$transaction(async (tx) => {
      const finalized = await tx.refundOperation.updateMany({ where: { id: operation.id, status: "PROCESSING", stripeRefundId: null }, data: { status: "COMPLETED", stripeRefundId: refund.id, nextAttemptAt: null, errorCode: null, errorMessage: null } });
      if (finalized.count !== 1) return;
      await tx.refundGroupAllocation.updateMany({ where: { refundOperationId: operation.id }, data: { status: "COMPLETED" } });
      const itemAllocations = await tx.refundItemAllocation.findMany({ where: { refundOperationId: operation.id }, include: { orderItem: { select: { orderGroup: { select: { kind: true } } } } } });
      for (const item of itemAllocations) {
        const returnApplicable = operation.returnRequired && item.orderItem.orderGroup?.kind === "MARKETPLACE";
        await tx.inventoryRestockEvent.upsert({
          where: { lifecycleKey: `return:${operation.id}:${item.orderItemId}` }, update: {},
          create: { refundOperationId: operation.id, orderItemId: item.orderItemId, quantity: item.quantity, status: returnApplicable ? "AWAITING_RETURN" : "NOT_APPLICABLE", reason: returnApplicable ? "RETURN_REQUIRED" : operation.returnRequired ? "CJ_PLATFORM_MANUAL" : "RETURN_NOT_REQUIRED", lifecycleKey: `return:${operation.id}:${item.orderItemId}`, idempotencyKey: `return:${operation.id}:${item.orderItemId}` },
        });
      }
      for (const allocation of operation.groupAllocations) {
        await tx.orderGroup.update({ where: { id: allocation.orderGroupId }, data: { refundedMerchandiseMinor: { increment: allocation.merchandiseAmountMinor }, refundedShippingMinor: { increment: allocation.shippingAmountMinor }, commissionReversedMinor: { increment: allocation.commissionReversalMinor }, sellerRecoveredMinor: { increment: allocation.sellerRecoveryMinor } } });
        if (allocation.orderGroup.kind === "MARKETPLACE" && allocation.sellerRecoveryMinor > 0 && allocation.orderGroup.stripeTransferId) {
          await tx.transferReversal.upsert({ where: { refundGroupAllocationId_orderGroupId: { refundGroupAllocationId: allocation.id, orderGroupId: allocation.orderGroupId } }, update: {}, create: { orderGroupId: allocation.orderGroupId, refundGroupAllocationId: allocation.id, amountMinor: allocation.sellerRecoveryMinor, currency: operation.currency, originalStripeTransferId: allocation.orderGroup.stripeTransferId, idempotencyKey: `seller-reversal:${allocation.id}` } });
        }
      }
      await tx.orderLifecycleEvent.create({ data: { orderId: operation.orderId, type: "BUYER_REFUND_COMPLETED", actorId: operation.reviewedById, createdAt: now, metadata: { refundOperationId: operation.id, stripeRefundId: refund.id, totalAmountMinor: operation.totalAmountMinor, currency: operation.currency } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
