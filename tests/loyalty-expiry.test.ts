import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { expireLoyaltyGrant, warnExpiringLoyaltyGrant } from "../lib/loyalty-expiry";

function fixture(reservations = 0) {
  const entries: Record<string, unknown>[] = [];
  const tx = {
    loyaltyGrant: {
      findUnique: async () => ({ id: "grant-a", accountId: "account-a",
        orderItemId: "item-a", status: "AVAILABLE",
        expiresAt: new Date("2026-09-23T00:00:00Z"),
        account: { buyerId: "buyer-a" } }),
      updateMany: async () => ({ count: 1 }),
    },
    $queryRaw: async () => [{ id: "account-a" }],
    loyaltyRedemptionReservation: { count: async () => reservations },
    loyaltyLedgerEntry: {
      findMany: async () => [
        { event: "EARN_PENDING", amountMinor: 200 },
        { event: "EARN_AVAILABLE", amountMinor: 200 },
        { event: "REDEEM", amountMinor: -50 },
        { event: "EARN_REVERSED", amountMinor: -25 },
      ],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        entries.push(data); return { id: "event-a" };
      },
    },
    notification: { create: async () => ({ id: "notification-a" }) },
  } as unknown as Prisma.TransactionClient;
  return { tx, entries };
}

test("expiry appends only unspent, unreversed liability", async () => {
  const state = fixture();
  assert.equal(await expireLoyaltyGrant(state.tx, "grant-a", new Date("2026-09-24T00:00:00Z")), 125);
  assert.equal(state.entries[0].event, "EXPIRED");
  assert.equal(state.entries[0].amountMinor, -125);
});

test("attested platform credit expiry closes only its own funded grant", async () => {
  const created: Record<string, unknown>[] = [];
  const tx = {
    loyaltyGrant: {
      findUnique: async () => ({ id: "platform-grant", accountId: "buyer-account",
        orderItemId: null, fundingSource: "PLATFORM_ADMIN", status: "AVAILABLE",
        expiresAt: new Date("2026-09-23T00:00:00Z"),
        account: { buyerId: "buyer-a" } }),
      updateMany: async () => ({ count: 1 }),
    },
    $queryRaw: async () => [{ id: "buyer-account" }],
    loyaltyRedemptionReservation: { count: async () => 0 },
    loyaltyLedgerEntry: {
      findMany: async () => [
        { event: "EARN_PENDING", amountMinor: 500 },
        { event: "ADMIN_ADJUSTMENT", amountMinor: 500 },
        { event: "REDEEM", amountMinor: -200 },
      ],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
      },
    },
    notification: { create: async () => ({ id: "notification-a" }) },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await expireLoyaltyGrant(tx, "platform-grant",
    new Date("2026-09-24T00:00:00Z")), 300);
  assert.equal(created[0].grantId, "platform-grant");
  assert.equal(created[0].event, "EXPIRED");
  assert.equal(created[0].amountMinor, -300);
});

test("an active checkout reservation delays expiry until it settles", async () => {
  const state = fixture(1);
  assert.equal(await expireLoyaltyGrant(state.tx, "grant-a", new Date("2026-09-24T00:00:00Z")), 0);
  assert.equal(state.entries.length, 0);
});

test("an expiring grant produces one warning before expiry without changing its ledger", async () => {
  const entries: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  let warnedAt: Date | null = null;
  const expiresAt = new Date("2026-10-10T00:00:00Z");
  const tx = {
    loyaltyGrant: {
      findUnique: async () => ({ id: "grant-a", accountId: "account-a", status: "AVAILABLE",
        expiresAt, expiryWarnedAt: warnedAt, account: { buyerId: "buyer-a" } }),
      updateMany: async ({ data }: { data: { expiryWarnedAt: Date } }) => {
        if (warnedAt) return { count: 0 };
        warnedAt = data.expiryWarnedAt;
        return { count: 1 };
      },
    },
    $queryRaw: async () => [{ id: "account-a" }],
    loyaltyLedgerEntry: { findMany: async () => [
      { event: "EARN_AVAILABLE", amountMinor: 200 },
      { event: "REDEEM", amountMinor: -50 },
    ], create: async ({ data }: { data: Record<string, unknown> }) => entries.push(data) },
    notification: { create: async ({ data }: { data: Record<string, unknown> }) => notifications.push(data) },
  } as unknown as Prisma.TransactionClient;
  const now = new Date("2026-09-24T00:00:00Z");
  assert.equal(await warnExpiringLoyaltyGrant(tx, "grant-a", now), true);
  assert.equal(await warnExpiringLoyaltyGrant(tx, "grant-a", now), false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "LOYALTY_EXPIRING");
  assert.equal(entries.length, 0);
});
