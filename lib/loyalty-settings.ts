import type { PrismaClient } from "@prisma/client";
import { requireAdmin } from "./admin-access";
import { storeLoyaltyAccounting } from "./loyalty-analytics";

export class LoyaltySettingsError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}

export const DEFAULT_LOYALTY_SETTINGS = Object.freeze({
  id: "global", enabled: false, rateBps: 200, minRateBps: 0,
  maxRateBps: 1000, expiryDays: 365, version: 0,
});

export function validateLoyaltySettings(value: unknown, current: {
  enabled: boolean; rateBps: number; minRateBps: number; maxRateBps: number; expiryDays: number;
} = DEFAULT_LOYALTY_SETTINGS) {
  if (!value || typeof value !== "object") throw new LoyaltySettingsError("INVALID_SETTINGS");
  const body = value as Record<string, unknown>;
  const integer = (key: string, fallback: number) => {
    const candidate = body[key] ?? fallback;
    if (!Number.isSafeInteger(candidate)) throw new LoyaltySettingsError("INVALID_SETTINGS");
    return candidate as number;
  };
  if (body.enabled != null && typeof body.enabled !== "boolean") throw new LoyaltySettingsError("INVALID_SETTINGS");
  const minRateBps = integer("minRateBps", current.minRateBps);
  const maxRateBps = integer("maxRateBps", current.maxRateBps);
  const rateBps = integer("rateBps", current.rateBps);
  const expiryDays = integer("expiryDays", current.expiryDays);
  if (minRateBps < 0 || maxRateBps > 1000 || minRateBps > rateBps || rateBps > maxRateBps || expiryDays < 30 || expiryDays > 1825) {
    throw new LoyaltySettingsError("LOYALTY_POLICY_OUT_OF_RANGE");
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) throw new LoyaltySettingsError("REASON_REQUIRED");
  return { enabled: body.enabled as boolean | undefined, rateBps, minRateBps, maxRateBps, expiryDays, reason };
}

export async function readLoyaltySettings(db: PrismaClient) {
  return await db.loyaltyProgramSettings.findUnique({ where: { id: "global" } }) ?? DEFAULT_LOYALTY_SETTINGS;
}

type ActivationGate = { allowed: boolean; releaseReference: string;
  treasuryReference: string; settlementReference: string };

export function loyaltyActivationGate(): ActivationGate {
  return {
    allowed: process.env.LOYALTY_ACTIVATION_ALLOWED === "true",
    releaseReference: process.env.LOYALTY_ACTIVATION_RELEASE_REFERENCE ?? "",
    treasuryReference: process.env.LOYALTY_TREASURY_APPROVAL_REFERENCE ?? "",
    settlementReference: process.env.LOYALTY_SETTLEMENT_APPROVAL_REFERENCE ?? "",
  };
}

export function loyaltyActivationReady(gate = loyaltyActivationGate()) {
  return gate.allowed && [gate.releaseReference, gate.treasuryReference,
    gate.settlementReference].every(value => /^[A-Za-z0-9._:/-]{8,200}$/.test(value));
}

/** Pausing future earning does not erase previously issued customer credit.
 * Before the first audited activation there can be no redemption at all. */
export async function loyaltyRedemptionPermitted(db: Pick<PrismaClient,
  "loyaltySettingsChange">, earningEnabled: boolean) {
  if (earningEnabled) return true;
  return Boolean(await db.loyaltySettingsChange?.findFirst({ where: {
    newEnabled: true,
  }, select: { id: true } }));
}

export async function updateLoyaltySettings(db: PrismaClient, adminId: string, raw: unknown,
  controls: { gate?: ActivationGate;
    verifyAccounting?: (db: PrismaClient) => Promise<boolean> } = {}) {
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, { userId: adminId });
    const current = await tx.loyaltyProgramSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    });
    const input = validateLoyaltySettings(raw, current);
    const body = raw as Record<string, unknown>;
    const changesActivation = input.enabled !== undefined && input.enabled !== current.enabled;
    if (changesActivation) {
      const expectedConfirmation = input.enabled ? "ENABLE_LOYALTY" : "DISABLE_LOYALTY";
      if (body.confirmation !== expectedConfirmation || input.reason.length < 10)
        throw new LoyaltySettingsError("LOYALTY_ACTIVATION_CONFIRMATION_REQUIRED", 400);
      if (input.enabled) {
        const gate = controls.gate ?? loyaltyActivationGate();
        if (!loyaltyActivationReady(gate) || body.releaseReference !== gate.releaseReference)
          throw new LoyaltySettingsError("LOYALTY_SETTLEMENT_NOT_READY", 409);
        const priorRelease = await tx.loyaltySettingsChange.findFirst({ where: {
          newEnabled: true, reason: { contains: `[release:${gate.releaseReference};` },
        }, select: { id: true } });
        if (priorRelease) throw new LoyaltySettingsError("LOYALTY_RELEASE_REFERENCE_REUSED", 409);
        const balanced = controls.verifyAccounting
          ? await controls.verifyAccounting(tx as unknown as PrismaClient)
          : (await storeLoyaltyAccounting(tx as unknown as PrismaClient, null)).balanced;
        if (!balanced) throw new LoyaltySettingsError("LOYALTY_RECONCILIATION_FAILED", 409);
      }
    }
    const next = { enabled: input.enabled ?? current.enabled, rateBps: input.rateBps,
      minRateBps: input.minRateBps, maxRateBps: input.maxRateBps, expiryDays: input.expiryDays };
    if (Object.entries(next).every(([key, value]) => current[key as keyof typeof next] === value)) return current;
    const changed = await tx.loyaltyProgramSettings.updateMany({
      where: { id: "global", version: current.version },
      data: { ...next, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new LoyaltySettingsError("SETTINGS_CHANGED_RETRY", 409);
    const gate = changesActivation && input.enabled
      ? controls.gate ?? loyaltyActivationGate() : null;
    const auditReason = gate
      ? `${input.reason} [release:${gate.releaseReference}; treasury:${gate.treasuryReference}; settlement:${gate.settlementReference}]`
      : input.reason;
    if (auditReason.length > 1000) throw new LoyaltySettingsError("REASON_TOO_LONG", 400);
    await tx.loyaltySettingsChange.create({ data: {
      settingsId: "global", adminId, oldEnabled: current.enabled, newEnabled: next.enabled,
      oldRateBps: current.rateBps, newRateBps: next.rateBps,
      oldMinRateBps: current.minRateBps, newMinRateBps: next.minRateBps,
      oldMaxRateBps: current.maxRateBps, newMaxRateBps: next.maxRateBps,
      oldExpiryDays: current.expiryDays, newExpiryDays: next.expiryDays,
      reason: auditReason,
    } });
    return tx.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } });
  });
}

export async function setStoreLoyaltyParticipation(db: PrismaClient, actorId: string, storeId: string, enabled: boolean) {
  return db.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: {
      id: true, ownerId: true, loyaltyEnabled: true, loyaltyBlockedAt: true,
    } });
    if (!store || store.ownerId !== actorId) throw new LoyaltySettingsError("STORE_NOT_OWNED", 403);
    if (enabled && store.loyaltyBlockedAt) throw new LoyaltySettingsError("LOYALTY_BLOCKED", 403);
    if (store.loyaltyEnabled === enabled) return { enabled, blocked: Boolean(store.loyaltyBlockedAt) };
    const changed = await tx.store.updateMany({
      where: { id: storeId, ownerId: actorId, loyaltyEnabled: store.loyaltyEnabled,
        ...(enabled ? { loyaltyBlockedAt: null } : {}) },
      data: { loyaltyEnabled: enabled },
    });
    if (changed.count !== 1) throw new LoyaltySettingsError("STORE_CHANGED_RETRY", 409);
    await tx.loyaltyStoreChange.create({ data: {
      storeId, actorId, actorRole: "SELLER", oldEnabled: store.loyaltyEnabled,
      newEnabled: enabled, oldBlockedAt: store.loyaltyBlockedAt,
      newBlockedAt: store.loyaltyBlockedAt, reason: "SELLER_PARTICIPATION_CHANGED",
    } });
    return { enabled, blocked: Boolean(store.loyaltyBlockedAt) };
  });
}

export async function setAdminStoreLoyaltyBlock(db: PrismaClient, adminId: string, storeId: string, blocked: boolean, reason: string) {
  if (!reason.trim() || reason.length > 1000) throw new LoyaltySettingsError("REASON_REQUIRED");
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, { userId: adminId });
    const store = await tx.store.findUnique({ where: { id: storeId }, select: {
      id: true, loyaltyEnabled: true, loyaltyBlockedAt: true,
    } });
    if (!store) throw new LoyaltySettingsError("STORE_NOT_FOUND", 404);
    const now = new Date();
    const nextBlockedAt = blocked ? store.loyaltyBlockedAt ?? now : null;
    const nextEnabled = blocked ? false : store.loyaltyEnabled;
    if (Boolean(store.loyaltyBlockedAt) === blocked && store.loyaltyEnabled === nextEnabled) return { enabled: nextEnabled, blocked };
    const changed = await tx.store.updateMany({
      where: { id: storeId, loyaltyEnabled: store.loyaltyEnabled, loyaltyBlockedAt: store.loyaltyBlockedAt },
      data: { loyaltyEnabled: nextEnabled, loyaltyBlockedAt: nextBlockedAt },
    });
    if (changed.count !== 1) throw new LoyaltySettingsError("STORE_CHANGED_RETRY", 409);
    await tx.loyaltyStoreChange.create({ data: {
      storeId, actorId: adminId, actorRole: "ADMIN", oldEnabled: store.loyaltyEnabled,
      newEnabled: nextEnabled, oldBlockedAt: store.loyaltyBlockedAt,
      newBlockedAt: nextBlockedAt, reason: reason.trim(),
    } });
    return { enabled: nextEnabled, blocked };
  });
}
