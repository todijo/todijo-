import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_LOYALTY_SETTINGS, loyaltyActivationReady, updateLoyaltySettings, validateLoyaltySettings } from "../lib/loyalty-settings";

test("loyalty starts off with a future configurable default 2%", () => {
  assert.equal(DEFAULT_LOYALTY_SETTINGS.enabled, false);
  assert.equal(DEFAULT_LOYALTY_SETTINGS.rateBps, 200);
  assert.deepEqual(validateLoyaltySettings({ enabled: true, reason: "Launch approved" }), {
    enabled: true, rateBps: 200, minRateBps: 0, maxRateBps: 1000,
    expiryDays: 365, reason: "Launch approved",
  });
});

test("activation remains closed without independently approved release controls", async () => {
  let settingsChanges = 0;
  const tx = {
    user: { findUnique: async () => ({ id: "admin-a", role: "ADMIN" }) },
    loyaltyProgramSettings: { upsert: async () => DEFAULT_LOYALTY_SETTINGS },
    loyaltySettingsChange: { create: async () => { settingsChanges++; } },
  };
  const db = { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as PrismaClient;
  await assert.rejects(updateLoyaltySettings(db, "admin-a", {
    enabled: true, reason: "Launch requested", confirmation: "ENABLE_LOYALTY",
    releaseReference: "release-2026-001",
  }), { code: "LOYALTY_SETTLEMENT_NOT_READY" });
  assert.equal(settingsChanges, 0);
});

test("activation requires complete operational references", () => {
  assert.equal(loyaltyActivationReady({ allowed: true, releaseReference: "release-001",
    treasuryReference: "treasury-001", settlementReference: "" }), false);
  assert.equal(loyaltyActivationReady({ allowed: false, releaseReference: "release-001",
    treasuryReference: "treasury-001", settlementReference: "settlement-001" }), false);
  assert.equal(loyaltyActivationReady({ allowed: true, releaseReference: "release-001",
    treasuryReference: "treasury-001", settlementReference: "settlement-001" }), true);
});

test("admin activation and deactivation are confirmed, reconciled and audited", async () => {
  const writes: Array<Record<string, unknown>> = [];
  let enabled = false;
  let version = 0;
  const tx = {
    user: { findUnique: async () => ({ id: "admin-a", role: "ADMIN" }) },
    loyaltyProgramSettings: {
      upsert: async () => ({ ...DEFAULT_LOYALTY_SETTINGS, enabled, version }),
      updateMany: async ({ where, data }: { where: { version: number }; data: { enabled: boolean } }) => {
        if (where.version !== version) return { count: 0 };
        enabled = data.enabled; version++;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...DEFAULT_LOYALTY_SETTINGS, enabled, version }),
    },
    loyaltySettingsChange: { findFirst: async ({ where }: { where: { reason: { contains: string } } }) =>
      writes.find(row => String(row.reason).includes(where.reason.contains)) ? { id: "prior" } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push(data);
    } },
  };
  const db = { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as PrismaClient;
  const gate = { allowed: true, releaseReference: "release-001",
    treasuryReference: "treasury-001", settlementReference: "settlement-001" };
  const activate = { enabled: true, reason: "Reviewed accounting and treasury release",
    confirmation: "ENABLE_LOYALTY", releaseReference: gate.releaseReference };
  await assert.rejects(updateLoyaltySettings(db, "admin-a", activate,
    { gate, verifyAccounting: async () => false }), { code: "LOYALTY_RECONCILIATION_FAILED" });
  assert.equal(writes.length, 0);
  await assert.rejects(updateLoyaltySettings(db, "admin-a", { ...activate,
    confirmation: "yes" }, { gate, verifyAccounting: async () => true }),
  { code: "LOYALTY_ACTIVATION_CONFIRMATION_REQUIRED" });
  await updateLoyaltySettings(db, "admin-a", activate,
    { gate, verifyAccounting: async () => true });
  assert.equal(enabled, true);
  assert.match(String(writes[0].reason), /release:release-001; treasury:treasury-001; settlement:settlement-001/);
  assert.equal(writes[0].adminId, "admin-a");
  await updateLoyaltySettings(db, "admin-a", { enabled: false,
    reason: "Pause further loyalty earning", confirmation: "DISABLE_LOYALTY" });
  assert.equal(enabled, false);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].oldEnabled, true);
  assert.equal(writes[1].newEnabled, false);
  await assert.rejects(updateLoyaltySettings(db, "admin-a", activate,
    { gate, verifyAccounting: async () => true }), { code: "LOYALTY_RELEASE_REFERENCE_REUSED" });
});

test("future admin rate update preserves current settings omitted from request", () => {
  const next = validateLoyaltySettings({ rateBps: 250, reason: "Pricing review" }, {
    enabled: true, rateBps: 200, minRateBps: 100, maxRateBps: 500, expiryDays: 730,
  });
  assert.equal(next.rateBps, 250);
  assert.equal(next.expiryDays, 730);
  assert.equal(next.minRateBps, 100);
  assert.equal(next.enabled, undefined);
});

test("invalid rates, expiry, and missing audit reason fail closed", () => {
  for (const input of [
    { rateBps: 1001, reason: "Too high" },
    { rateBps: -1, reason: "Negative" },
    { rateBps: 2.5, reason: "Use basis points" },
    { expiryDays: 0, reason: "No expiry" },
    { minRateBps: 300, maxRateBps: 200, reason: "Inverted" },
    { enabled: true },
    { enabled: "true", reason: "Wrong type" },
  ]) assert.throws(() => validateLoyaltySettings(input));
});
