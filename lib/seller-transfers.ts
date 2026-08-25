import { Prisma, type PrismaClient } from "@prisma/client";
import { isEffectiveBlock, validateAdminReason } from "./account-status";
import { requireAdmin } from "./admin-access";
import { connectedAccountReady, connectedAccountStatus, createStripeTransfer, retrieveConnectedAccount, StripeTransportError } from "./stripe";
import { resolveSellerMaturity, transferEligibility } from "./seller-maturity";

type Database = PrismaClient | Prisma.TransactionClient;
export const SELLER_TRANSFER_STALE_CLAIM_MS = 15 * 60_000;

export async function markSellerGroupsShipmentVerified(db: Database, orderId: string, storeIds: string[], now = new Date()) {
  const results = [];
  for (const storeId of [...new Set(storeIds)]) {
    const current = await db.orderGroup.findUnique({ where: { orderId_groupKey: { orderId, groupKey: `store:${storeId}` } }, select: { id: true, kind: true, shipmentVerifiedAt: true } });
    if (!current || current.kind !== "MARKETPLACE" || current.shipmentVerifiedAt) continue;
    const evidence = await resolveSellerMaturity(db, storeId, now);
    const eligibility = transferEligibility(evidence.classification, now, now);
    const changed = await db.orderGroup.updateMany({
      where: { id: current.id, kind: "MARKETPLACE", transferStatus: "WAITING_FOR_SHIPMENT", shipmentVerifiedAt: null },
      data: {
        shipmentVerifiedAt: now,
        maturitySnapshot: evidence.classification,
        maturityEvidence: evidence as unknown as Prisma.InputJsonValue,
        transferEligibleAt: evidence.classification === "HIGH_RISK" ? null : eligibility.eligibleAt,
        transferStatus: evidence.classification === "HIGH_RISK" ? "MANUAL_ACTION_REQUIRED" : eligibility.eligible ? "READY" : "RESERVE_PERIOD",
        transferIdempotencyKey: `seller-transfer:${orderId}:${storeId}`,
      },
    });
    if (changed.count === 1) results.push(await db.orderGroup.findUniqueOrThrow({ where: { id: current.id } }));
  }
  return results;
}

export async function releaseHighRiskSellerTransfer(db: PrismaClient, session: { userId: string; role?: string } | null, groupId: string, reasonInput: unknown, now = new Date()) {
  const admin = await requireAdmin(db, session);
  const reason = validateAdminReason(reasonInput);
  return db.$transaction(async (tx) => {
    const group = await tx.orderGroup.findUnique({ where: { id: groupId }, select: { id: true, orderId: true, kind: true, maturitySnapshot: true, shipmentVerifiedAt: true, transferStatus: true, stripeTransferId: true } });
    if (!group || group.kind !== "MARKETPLACE" || group.maturitySnapshot !== "HIGH_RISK" || !group.shipmentVerifiedAt) throw new Error("High-risk shipped marketplace group not found.");
    if (["READY", "SUBMITTING", "TRANSFERRED", "RETRYABLE"].includes(group.transferStatus)) return { changed: false, idempotent: true, transferStatus: group.transferStatus };
    const changed = await tx.orderGroup.updateMany({ where: { id: group.id, transferStatus: "MANUAL_ACTION_REQUIRED", stripeTransferId: null }, data: { transferStatus: "READY", transferEligibleAt: now, nextTransferAttemptAt: null, transferErrorCode: null, transferErrorMessage: null } });
    if (changed.count !== 1) return { changed: false, idempotent: true, transferStatus: group.transferStatus };
    await tx.orderLifecycleEvent.create({ data: { orderId: group.orderId, type: "SELLER_TRANSFER_RISK_RELEASED", actorId: admin.id, createdAt: now, metadata: { orderGroupId: group.id, maturity: group.maturitySnapshot, shipmentVerifiedAt: group.shipmentVerifiedAt.toISOString(), releasedAt: now.toISOString(), reason } } });
    return { changed: true, idempotent: false, transferStatus: "READY" as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function processEligibleSellerTransfer(db: PrismaClient, groupId: string, now = new Date(), submit = createStripeTransfer, retrieve = retrieveConnectedAccount) {
  const claimed = await db.orderGroup.updateMany({ where: { id: groupId, kind: "MARKETPLACE", transferStatus: { in: ["READY", "RETRYABLE"] }, transferEligibleAt: { lte: now }, stripeConnectedAccountId: { not: null }, stripeTransferId: null }, data: { transferStatus: "SUBMITTING", nextTransferAttemptAt: new Date(now.getTime() + SELLER_TRANSFER_STALE_CLAIM_MS), transferAttemptCount: { increment: 1 } } });
  if (claimed.count !== 1) return { idempotent: true };
  const group = await db.orderGroup.findUniqueOrThrow({ where: { id: groupId }, select: { id: true, orderId: true, stripeConnectedAccountId: true, sellerNetAmountMinor: true, sellerRecoveredMinor: true, transferSubmittedAmountMinor: true, transferErrorCode: true, transferIdempotencyKey: true, store: { select: { status: true, owner: { select: { id: true, stripeAccountId: true, sellerSuspendedAt: true, deactivatedAt: true, blockedAt: true, blockExpiresAt: true } } } }, order: { select: { currency: true } } } });
  let payableAmount = 0;
  try {
    const ambiguousRetry = group.transferErrorCode === "STALE_TRANSFER_CLAIM_RECOVERED" && group.transferSubmittedAmountMinor != null;
    // Only a stale possibly-accepted submission reuses the exact persisted request amount.
    // Ordinary known failures recalculate the current entitlement after refunds.
    payableAmount = ambiguousRetry ? group.transferSubmittedAmountMinor! : Math.max(0, group.sellerNetAmountMinor - (group.sellerRecoveredMinor ?? 0));
    if (payableAmount === 0) {
      await db.orderGroup.update({ where: { id: group.id }, data: { transferStatus: "CANCELLED", transferSubmittedAmountMinor: null, nextTransferAttemptAt: null, transferErrorCode: null, transferErrorMessage: null } });
      return { transferred: false, cancelled: true };
    }
    const owner = group.store?.owner;
    if (!owner || group.store?.status !== "ACTIVE" || owner.sellerSuspendedAt || owner.deactivatedAt || isEffectiveBlock(owner, now)) throw new Error("Seller activity is not eligible for transfers.");
    const authoritativeId = owner.stripeAccountId;
    if (!authoritativeId || authoritativeId !== group.stripeConnectedAccountId) throw new Error("Seller connected account no longer matches the checkout snapshot.");
    const account = await retrieve(authoritativeId);
    await db.user.update({ where: { id: owner.id }, data: connectedAccountStatus(account) });
    if (!connectedAccountReady(account, authoritativeId)) throw new Error("Seller connected account is not ready for transfers.");
    await db.orderGroup.update({ where: { id: group.id }, data: { transferSubmittedAmountMinor: payableAmount } });
  } catch (error) {
    await db.orderGroup.update({ where: { id: group.id }, data: { transferStatus: "RETRYABLE", transferSubmittedAmountMinor: null, nextTransferAttemptAt: new Date(now.getTime() + 15 * 60_000), transferErrorCode: "SELLER_TRANSFER_FAILED", transferErrorMessage: error instanceof Error ? error.message.slice(0, 500) : "Stripe transfer failed" } });
    throw error;
  }
  let transfer: { id: string };
  try {
    transfer = await submit({ amount: payableAmount, currency: group.order.currency, destination: group.stripeConnectedAccountId!, transferGroup: `order:${group.orderId}`, idempotencyKey: group.transferIdempotencyKey! });
  } catch (error) {
    // A transport failure may have reached Stripe. Leave SUBMITTING + submitted amount
    // intact so the stale lease retries the identical request.
    if (error instanceof StripeTransportError) throw error;
    await db.orderGroup.update({ where: { id: group.id }, data: { transferStatus: "RETRYABLE", transferSubmittedAmountMinor: null, nextTransferAttemptAt: new Date(now.getTime() + 15 * 60_000), transferErrorCode: "SELLER_TRANSFER_FAILED", transferErrorMessage: error instanceof Error ? error.message.slice(0, 500) : "Stripe transfer failed" } });
    throw error;
  }
  // If finalization fails after Stripe accepted the request, retain SUBMITTING and the
  // exact submitted amount for stale idempotent recovery.
  await db.orderGroup.update({ where: { id: group.id }, data: { transferStatus: "TRANSFERRED", stripeTransferId: transfer.id, transferredAt: now, nextTransferAttemptAt: null, transferErrorCode: null, transferErrorMessage: null } });
  return { transferred: true, id: transfer.id };
}

export async function processDueSellerTransfers(db: PrismaClient, now = new Date(), limit = 25, process = processEligibleSellerTransfer) {
  await db.orderGroup.updateMany({ where: { kind: "MARKETPLACE", transferStatus: "SUBMITTING", nextTransferAttemptAt: { lte: now }, shipmentVerifiedAt: { not: null }, transferEligibleAt: { lte: now }, transferIdempotencyKey: { not: null }, stripeTransferId: null }, data: { transferStatus: "RETRYABLE", nextTransferAttemptAt: now, transferErrorCode: "STALE_TRANSFER_CLAIM_RECOVERED", transferErrorMessage: "A stale transfer claim was recovered for idempotent retry." } });
  await db.orderGroup.updateMany({ where: { kind: "MARKETPLACE", maturitySnapshot: "NEW", transferStatus: "RESERVE_PERIOD", shipmentVerifiedAt: { not: null }, transferEligibleAt: { lte: now }, stripeTransferId: null }, data: { transferStatus: "READY" } });
  const due = await db.orderGroup.findMany({ where: { kind: "MARKETPLACE", transferStatus: { in: ["READY", "RETRYABLE"] }, shipmentVerifiedAt: { not: null }, transferEligibleAt: { lte: now }, stripeTransferId: null, OR: [{ nextTransferAttemptAt: null }, { nextTransferAttemptAt: { lte: now } }] }, orderBy: [{ transferEligibleAt: "asc" }, { id: "asc" }], take: Math.max(1, Math.min(limit, 100)), select: { id: true } });
  const results = [];
  for (const group of due) {
    try { results.push({ groupId: group.id, result: await process(db, group.id, now) }); }
    catch (error) { results.push({ groupId: group.id, error: error instanceof Error ? error.message : "SELLER_TRANSFER_FAILED" }); }
  }
  return { processed: results.length, results };
}
