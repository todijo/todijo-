import { Prisma, type PrismaClient } from "@prisma/client";
import { requireAdmin } from "./admin-access";
import { isEffectiveBlock } from "./account-status";
import { releaseDeliveredLoyalty } from "./loyalty-availability";

export class LoyaltyAdjustmentError extends Error {
  constructor(public readonly code: string, public readonly status = 409) {
    super(code);
  }
}

/** Every high-risk admin HTTP mutation requires a typed, operation-specific
 * confirmation. This is independent of the immutable ledger validations. */
export function assertLoyaltyAdjustmentConfirmation(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new LoyaltyAdjustmentError("INVALID_LOYALTY_ADJUSTMENT", 400);
  const body = raw as Record<string, unknown>;
  const expected: Record<string, string> = {
    CREDIT: "PLEDGE_PLATFORM_CREDIT",
    DEBIT: "REVOKE_PLATFORM_CREDIT",
    ATTEST_PLATFORM: "ATTEST_PLATFORM_FUNDING",
    CANCEL_PLATFORM_PLEDGE: "CANCEL_PLATFORM_PLEDGE",
    SELLER_REPAIR: "REPAIR_SELLER_RESERVE",
  };
  if (typeof body.direction !== "string" || !expected[body.direction])
    throw new LoyaltyAdjustmentError("INVALID_LOYALTY_ADJUSTMENT", 400);
  if (body.confirmation !== expected[body.direction])
    throw new LoyaltyAdjustmentError("LOYALTY_ADJUSTMENT_CONFIRMATION_REQUIRED", 400);
}

type AdjustmentInput = { buyerId: string; storeId: string; amountMinor: number;
  reference: string; reason: string; fundingSource: "PLATFORM_ADMIN" };

function validate(input: AdjustmentInput) {
  if (!input || input.fundingSource !== "PLATFORM_ADMIN" ||
    typeof input.buyerId !== "string" || !input.buyerId ||
    typeof input.storeId !== "string" || !input.storeId ||
    !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 ||
    input.amountMinor > 1_000_000_000 ||
    typeof input.reference !== "string" ||
    !/^[A-Za-z0-9._-]{8,120}$/.test(input.reference) ||
    typeof input.reason !== "string" || input.reason.trim().length < 10 ||
    input.reason.trim().length > 1000)
    throw new LoyaltyAdjustmentError("INVALID_LOYALTY_ADJUSTMENT", 400);
  return { ...input, reason: input.reason.trim() };
}

/** Issuance records a platform pledge, NOT spendable cash. Independent
 * treasury attestation is required before the grant becomes available. */
export async function issuePlatformLoyaltyCredit(db: PrismaClient, adminId: string,
  raw: AdjustmentInput, now = new Date()) {
  const input = validate(raw);
  if (!Number.isFinite(now.getTime())) throw new LoyaltyAdjustmentError("INVALID_ADJUSTMENT_DATE", 400);
  return db.$transaction(async tx => {
    await requireAdmin(tx, { userId: adminId });
    const existing = await tx.loyaltyPlatformFunding.findUnique({ where: {
      reference: input.reference }, include: { account: true, grant: true } });
    if (existing) {
      if (existing.adminId !== adminId || existing.account.buyerId !== input.buyerId ||
        existing.account.storeId !== input.storeId ||
        existing.amountMinor !== input.amountMinor || existing.reason !== input.reason)
        throw new LoyaltyAdjustmentError("ADJUSTMENT_REFERENCE_CONFLICT");
      return { grantId: existing.grantId, amountMinor: existing.amountMinor,
        status: existing.grant.status, idempotent: true };
    }
    const settings = await tx.loyaltyProgramSettings.findUnique({ where: { id: "global" },
      select: { enabled: true, expiryDays: true } });
    if (!settings?.enabled) throw new LoyaltyAdjustmentError("LOYALTY_PROGRAM_DISABLED");
    const [buyer, store] = await Promise.all([
      tx.user.findUnique({ where: { id: input.buyerId }, select: {
        id: true, deactivatedAt: true, blockedAt: true, blockExpiresAt: true } }),
      tx.store.findUnique({ where: { id: input.storeId }, select: { id: true, status: true } }),
    ]);
    if (!buyer || buyer.deactivatedAt || isEffectiveBlock(buyer, now))
      throw new LoyaltyAdjustmentError("BUYER_NOT_ELIGIBLE");
    if (!store || store.status !== "ACTIVE")
      throw new LoyaltyAdjustmentError("STORE_NOT_ELIGIBLE");
    const account = await tx.loyaltyAccount.upsert({ where: {
      buyerId_storeId_currency: { buyerId: input.buyerId,
        storeId: input.storeId, currency: "EUR" },
    }, create: { buyerId: input.buyerId, storeId: input.storeId, currency: "EUR" },
    update: {} });
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${account.id} FOR UPDATE`;
    const grant = await tx.loyaltyGrant.create({ data: {
      accountId: account.id, fundingSource: "PLATFORM_ADMIN", rateBps: 0,
      expiryDays: settings.expiryDays, amountMinor: input.amountMinor,
      status: "PENDING",
    } });
    await tx.loyaltyPlatformFunding.create({ data: {
      accountId: account.id, grantId: grant.id, adminId,
      amountMinor: input.amountMinor, reference: input.reference, reason: input.reason,
    } });
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: account.id, grantId: grant.id, adminId,
      event: "EARN_PENDING", amountMinor: input.amountMinor,
      reference: `admin:pledge:${input.reference}`, reason: input.reason,
      metadata: { fundingSource: "PLATFORM_ADMIN", treasuryReference: input.reference },
    } });
    return { grantId: grant.id, amountMinor: input.amountMinor,
      status: "PENDING" as const, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** A second administrator attests an external finance journal/bank reference.
 * This is an auditable treasury control, not a synthetic Stripe balance or
 * a claim that funds are segregated inside Stripe. */
export async function attestPlatformLoyaltyFunding(db: PrismaClient, verifierId: string,
  raw: { reference: string; evidenceReference: string; note: string }, now = new Date()) {
  if (!raw || typeof raw.reference !== "string" ||
    !/^[A-Za-z0-9._-]{8,120}$/.test(raw.reference) ||
    typeof raw.evidenceReference !== "string" ||
    !/^[A-Za-z0-9._:/-]{8,200}$/.test(raw.evidenceReference) ||
    typeof raw.note !== "string" || raw.note.trim().length < 10 ||
    raw.note.trim().length > 1000 || !Number.isFinite(now.getTime()))
    throw new LoyaltyAdjustmentError("INVALID_FUNDING_ATTESTATION", 400);
  const note = raw.note.trim();
  return db.$transaction(async tx => {
    await requireAdmin(tx, { userId: verifierId });
    const funding = await tx.loyaltyPlatformFunding.findUnique({ where: {
      reference: raw.reference }, include: { account: true, grant: true,
        attestation: true } });
    if (!funding) throw new LoyaltyAdjustmentError("PLATFORM_FUNDING_NOT_FOUND", 404);
    if (funding.adminId === verifierId)
      throw new LoyaltyAdjustmentError("INDEPENDENT_VERIFIER_REQUIRED", 403);
    if (funding.attestation) {
      if (funding.attestation.verifierId !== verifierId ||
        funding.attestation.evidenceReference !== raw.evidenceReference ||
        funding.attestation.note !== note)
        throw new LoyaltyAdjustmentError("ATTESTATION_REFERENCE_CONFLICT");
      return { grantId: funding.grantId, amountMinor: funding.amountMinor,
        status: "AVAILABLE" as const, idempotent: true };
    }
    if (funding.grant.status !== "PENDING" ||
      funding.grant.fundingSource !== "PLATFORM_ADMIN" ||
      funding.grant.amountMinor !== funding.amountMinor ||
      funding.grant.accountId !== funding.accountId)
      throw new LoyaltyAdjustmentError("PLATFORM_FUNDING_MISMATCH");
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${funding.accountId} FOR UPDATE`;
    await tx.loyaltyPlatformFundingAttestation.create({ data: {
      fundingId: funding.id, verifierId, evidenceReference: raw.evidenceReference,
      note,
    } });
    const changed = await tx.loyaltyGrant.updateMany({ where: {
      id: funding.grantId, status: "PENDING", fundingSource: "PLATFORM_ADMIN",
    }, data: { status: "AVAILABLE", availableAt: now,
      expiresAt: new Date(now.getTime() + funding.grant.expiryDays * 86_400_000) } });
    if (changed.count !== 1) throw new LoyaltyAdjustmentError("PLATFORM_FUNDING_RACE");
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: funding.accountId, grantId: funding.grantId,
      adminId: verifierId, event: "ADMIN_ADJUSTMENT",
      amountMinor: funding.amountMinor, reason: note,
      reference: `admin:credit:${funding.reference}`,
      metadata: { fundingSource: "PLATFORM_ADMIN",
        treasuryReference: funding.reference,
        evidenceReference: raw.evidenceReference,
        issuedById: funding.adminId },
    } });
    await tx.notification.create({ data: { userId: funding.account.buyerId,
      type: "LOYALTY_AVAILABLE", title: "Crédit fidélité disponible",
      body: "Todijo a ajouté un crédit fidélité à votre compte.",
      href: "/account/loyalty" } });
    return { grantId: funding.grantId, amountMinor: funding.amountMinor,
      status: "AVAILABLE" as const, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** A pledged but unattested goodwill grant is not spendable. Canceling it
 * appends immutable evidence rather than deleting the pledge or its audit. */
export async function cancelPendingPlatformLoyaltyPledge(db: PrismaClient,
  adminId: string, raw: { reference: string; reason: string }) {
  if (!raw || typeof raw.reference !== "string" ||
    !/^[A-Za-z0-9._-]{8,120}$/.test(raw.reference) ||
    typeof raw.reason !== "string" || raw.reason.trim().length < 10 ||
    raw.reason.trim().length > 1000)
    throw new LoyaltyAdjustmentError("INVALID_PLEDGE_CANCELLATION", 400);
  const reason = raw.reason.trim();
  return db.$transaction(async tx => {
    await requireAdmin(tx, { userId: adminId });
    const funding = await tx.loyaltyPlatformFunding.findUnique({ where: {
      reference: raw.reference }, include: { grant: true, attestation: true } });
    if (!funding) throw new LoyaltyAdjustmentError("PLATFORM_FUNDING_NOT_FOUND", 404);
    const eventReference = `admin:pledge-cancel:${funding.reference}`;
    const prior = await tx.loyaltyLedgerEntry.findUnique({ where: {
      reference: eventReference }, select: { adminId: true, reason: true,
      grantId: true, amountMinor: true } });
    if (prior) {
      if (prior.adminId !== adminId || prior.reason !== reason ||
        prior.grantId !== funding.grantId || prior.amountMinor !== -funding.amountMinor)
        throw new LoyaltyAdjustmentError("ADJUSTMENT_REFERENCE_CONFLICT");
      return { grantId: funding.grantId, status: "REVERSED" as const,
        idempotent: true };
    }
    if (funding.attestation || funding.grant.status !== "PENDING" ||
      funding.grant.fundingSource !== "PLATFORM_ADMIN")
      throw new LoyaltyAdjustmentError("PLATFORM_PLEDGE_NOT_CANCELLABLE");
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${funding.accountId} FOR UPDATE`;
    const changed = await tx.loyaltyGrant.updateMany({ where: {
      id: funding.grantId, status: "PENDING", fundingSource: "PLATFORM_ADMIN",
    }, data: { status: "REVERSED", reversedMinor: funding.amountMinor } });
    if (changed.count !== 1) throw new LoyaltyAdjustmentError("PLATFORM_FUNDING_RACE");
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: funding.accountId, grantId: funding.grantId,
      adminId, event: "EARN_PENDING_REVERSED", amountMinor: -funding.amountMinor,
      reference: eventReference, reason,
      metadata: { fundingSource: "PLATFORM_ADMIN",
        treasuryReference: funding.reference },
    } });
    return { grantId: funding.grantId, status: "REVERSED" as const,
      idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** A debit can only correct the unspent part of an identified platform-funded
 * grant. It cannot seize a seller's funded obligation or race an active hold. */
export async function revokePlatformLoyaltyCredit(db: PrismaClient, adminId: string,
  raw: AdjustmentInput & { grantId: string }, now = new Date()) {
  const input = validate(raw);
  if (typeof raw.grantId !== "string" || !raw.grantId)
    throw new LoyaltyAdjustmentError("INVALID_LOYALTY_GRANT", 400);
  return db.$transaction(async tx => {
    await requireAdmin(tx, { userId: adminId });
    const reference = `admin:debit:${input.reference}`;
    const prior = await tx.loyaltyLedgerEntry.findUnique({ where: { reference },
      select: { adminId: true, grantId: true, amountMinor: true, reason: true } });
    if (prior) {
      if (prior.adminId !== adminId || prior.grantId !== raw.grantId ||
        prior.amountMinor !== -input.amountMinor || prior.reason !== input.reason)
        throw new LoyaltyAdjustmentError("ADJUSTMENT_REFERENCE_CONFLICT");
      return { grantId: raw.grantId, amountMinor: -input.amountMinor, idempotent: true };
    }
    const grant = await tx.loyaltyGrant.findUnique({ where: { id: raw.grantId },
      select: { id: true, accountId: true, status: true, fundingSource: true,
        reversedMinor: true, expiresAt: true,
        account: { select: { buyerId: true, storeId: true } } } });
    if (!grant || grant.fundingSource !== "PLATFORM_ADMIN" ||
      grant.account.buyerId !== input.buyerId || grant.account.storeId !== input.storeId ||
      grant.status !== "AVAILABLE" || !grant.expiresAt || grant.expiresAt <= now)
      throw new LoyaltyAdjustmentError("PLATFORM_GRANT_NOT_REVOCABLE");
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${grant.accountId} FOR UPDATE`;
    const active = await tx.loyaltyRedemptionReservation.count({ where: {
      accountId: grant.accountId, status: "ACTIVE" } });
    if (active) throw new LoyaltyAdjustmentError("LOYALTY_CREDIT_RESERVED");
    const entries = await tx.loyaltyLedgerEntry.findMany({ where: { grantId: grant.id },
      select: { event: true, amountMinor: true } });
    const remaining = entries.reduce((sum, entry) =>
      entry.event === "EARN_PENDING" || entry.event === "EARN_PENDING_REVERSED"
        ? sum : sum + entry.amountMinor, 0);
    if (remaining < input.amountMinor)
      throw new LoyaltyAdjustmentError("PLATFORM_CREDIT_INSUFFICIENT");
    const changed = await tx.loyaltyGrant.updateMany({ where: {
      id: grant.id, status: "AVAILABLE", reversedMinor: grant.reversedMinor },
    data: { reversedMinor: { increment: input.amountMinor },
      ...(remaining === input.amountMinor ? { status: "REVERSED" } : {}) } });
    if (changed.count !== 1) throw new LoyaltyAdjustmentError("LOYALTY_ADJUSTMENT_RACE");
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: grant.accountId, grantId: grant.id, adminId,
      event: "ADMIN_ADJUSTMENT", amountMinor: -input.amountMinor,
      reference, reason: input.reason,
      metadata: { fundingSource: "PLATFORM_ADMIN", treasuryReference: input.reference },
    } });
    await tx.notification.create({ data: { userId: input.buyerId,
      type: "LOYALTY_REVERSED", title: "Crédit fidélité ajusté",
      body: "Todijo a ajusté votre crédit fidélité.", href: "/account/loyalty" } });
    return { grantId: grant.id, amountMinor: -input.amountMinor, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Repair only a missing seller-funded grant whose reserve was already
 * snapshotted and deducted in a verified paid order. No new seller liability
 * is invented and no goodwill/platform funding is substituted. */
export async function repairSellerLoyaltyEarning(db: PrismaClient, adminId: string,
  raw: { fundingSource: "SELLER_RESERVE"; orderItemId: string;
    reference: string; reason: string }) {
  if (!raw || raw.fundingSource !== "SELLER_RESERVE" ||
    typeof raw.orderItemId !== "string" || !raw.orderItemId ||
    typeof raw.reference !== "string" || !/^[A-Za-z0-9._-]{8,120}$/.test(raw.reference) ||
    typeof raw.reason !== "string" || raw.reason.trim().length < 10 ||
    raw.reason.trim().length > 1000)
    throw new LoyaltyAdjustmentError("INVALID_LOYALTY_ADJUSTMENT", 400);
  const reason = raw.reason.trim();
  return db.$transaction(async tx => {
    await requireAdmin(tx, { userId: adminId });
    const item = await tx.orderItem.findUnique({ where: { id: raw.orderItemId },
      select: { id: true, orderId: true, orderGroupId: true,
        loyaltyEligibleSnapshot: true, loyaltyEarnMinor: true,
        loyaltyRateBpsSnapshot: true, loyaltyExpiryDaysSnapshot: true } });
    if (!item || !item.orderGroupId || !item.loyaltyEligibleSnapshot ||
      item.loyaltyEarnMinor <= 0 || !item.loyaltyRateBpsSnapshot ||
      !item.loyaltyExpiryDaysSnapshot)
      throw new LoyaltyAdjustmentError("SELLER_EARNING_EVIDENCE_MISSING");
    const auditReference = `admin:seller-repair:${raw.reference}`;
    const existing = await tx.loyaltyGrant.findUnique({ where: { orderItemId: item.id },
      select: { id: true } });
    if (existing) {
      const audit = await tx.loyaltyLedgerEntry.findUnique({ where: { reference: auditReference },
        select: { grantId: true, adminId: true, amountMinor: true, reason: true } });
      if (audit?.grantId === existing.id && audit.adminId === adminId &&
        audit.amountMinor === item.loyaltyEarnMinor && audit.reason === reason)
        return { grantId: existing.id, amountMinor: item.loyaltyEarnMinor,
          fundingSource: "SELLER_RESERVE" as const, idempotent: true };
      throw new LoyaltyAdjustmentError("SELLER_EARNING_ALREADY_RECORDED");
    }
    const [order, group, sum, refunds] = await Promise.all([
      tx.order.findUnique({ where: { id: item.orderId }, select: {
        buyerId: true, currency: true, paidAt: true, status: true } }),
      tx.orderGroup.findUnique({ where: { id: item.orderGroupId }, select: {
        orderId: true, storeId: true, loyaltyReserveMinor: true,
        itemSubtotalMinor: true, shippingAmountMinor: true,
        platformFeeAmountMinor: true, sellerNetAmountMinor: true } }),
      tx.orderItem.aggregate({ where: { orderGroupId: item.orderGroupId },
        _sum: { loyaltyEarnMinor: true } }),
      tx.refundOperation.count({ where: { orderId: item.orderId } }),
    ]);
    if (!order?.paidAt || order.currency !== "EUR" ||
      !["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status) ||
      !group?.storeId || group.orderId !== item.orderId || refunds ||
      sum._sum.loyaltyEarnMinor !== group.loyaltyReserveMinor ||
      group.sellerNetAmountMinor !== group.itemSubtotalMinor + group.shippingAmountMinor -
        group.platformFeeAmountMinor - group.loyaltyReserveMinor)
      throw new LoyaltyAdjustmentError("SELLER_RESERVE_NOT_VERIFIED");
    const account = await tx.loyaltyAccount.upsert({ where: {
      buyerId_storeId_currency: { buyerId: order.buyerId, storeId: group.storeId,
        currency: "EUR" },
    }, create: { buyerId: order.buyerId, storeId: group.storeId, currency: "EUR" },
    update: {} });
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${account.id} FOR UPDATE`;
    const grant = await tx.loyaltyGrant.create({ data: {
      accountId: account.id, orderItemId: item.id, orderGroupId: item.orderGroupId,
      fundingSource: "SELLER_RESERVE", rateBps: item.loyaltyRateBpsSnapshot,
      expiryDays: item.loyaltyExpiryDaysSnapshot, amountMinor: item.loyaltyEarnMinor,
    } });
    await tx.loyaltyLedgerEntry.create({ data: {
      accountId: account.id, grantId: grant.id, orderId: item.orderId,
      adminId, event: "EARN_PENDING", amountMinor: item.loyaltyEarnMinor,
      reference: auditReference, reason,
      metadata: { fundingSource: "SELLER_RESERVE", orderItemId: item.id,
        orderGroupId: item.orderGroupId },
    } });
    if (order.status === "DELIVERED")
      await releaseDeliveredLoyalty(tx, item.orderId);
    return { grantId: grant.id, amountMinor: item.loyaltyEarnMinor,
      fundingSource: "SELLER_RESERVE" as const, idempotent: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
