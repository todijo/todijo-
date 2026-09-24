import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { restoreRefundedLoyalty, reverseRefundedLoyalty } from "../lib/loyalty-refunds";

function fakeRefund(grantStatus: "PENDING" | "AVAILABLE" | "EXPIRED", refundedQuantity: number) {
  const created: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [{ id: "account-a" }],
    refundItemAllocation: { findMany: async ({ where }: { where: Record<string, unknown> }) =>
      "refundOperationId" in where
        ? [{ orderItemId: "item-a", orderItem: { quantity: 2, loyaltyGrant: {
          id: "grant-a", accountId: "account-a", amountMinor: 200,
          reversedMinor: 0, status: grantStatus,
        } } }]
        : [{ quantity: refundedQuantity }] },
    loyaltyGrant: { updateMany: async ({ data }: { data: Record<string, unknown> }) => {
      updates.push(data); return { count: 1 };
    } },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data); return { id: "event-a" };
    }, findMany: async () => [{ amountMinor: -100 }] },
    order: { findUniqueOrThrow: async () => ({ buyerId: "buyer-a" }) },
    notification: { create: async ({ data }: { data: Record<string, unknown> }) => {
      notifications.push(data); return { id: "notification-a" };
    } },
  } as unknown as Prisma.TransactionClient;
  return { tx, created, updates, notifications };
}

test("pending refund reduces pending credit without creating spendable debt", async () => {
  const state = fakeRefund("PENDING", 1);
  assert.equal(await reverseRefundedLoyalty(state.tx, "refund-a", "order-a"), 100);
  assert.equal(state.created[0].event, "EARN_PENDING_REVERSED");
  assert.equal(state.created[0].amountMinor, -100);
  assert.deepEqual(state.updates[0].reversedMinor, { increment: 100 });
  assert.equal(state.notifications.length, 0);
});

test("late full refund reverses available credit, even when previously spent", async () => {
  const state = fakeRefund("AVAILABLE", 2);
  assert.equal(await reverseRefundedLoyalty(state.tx, "refund-a", "order-a"), 200);
  assert.equal(state.created[0].event, "EARN_REVERSED");
  assert.equal(state.created[0].amountMinor, -200);
  assert.equal(state.updates[0].status, "REVERSED");
  assert.equal(state.notifications[0].type, "LOYALTY_REVERSED");
});

test("refund after expiry offsets expired liability before recording owed credit", async () => {
  const state = fakeRefund("EXPIRED", 2);
  assert.equal(await reverseRefundedLoyalty(state.tx, "refund-a", "order-a"), 200);
  assert.deepEqual(state.created.map(entry => [entry.event, entry.amountMinor]), [
    ["EXPIRED_RESTORED", 100], ["EARN_REVERSED", -200],
  ]);
});

test("confirmed partial refund restores only the redeemed share of refunded units", async () => {
  const created: Record<string, unknown>[] = [];
  let restoredMinor = 0;
  const tx = {
    $queryRaw: async () => [{ id: "account-a" }],
    refundItemAllocation: { findMany: async ({ where }: { where: Record<string, unknown> }) =>
      "refundOperationId" in where ? [{ orderItemId: "item-a", orderItem: { quantity: 2,
        loyaltyRedemptionAllocations: [{ id: "allocation-a", grantId: "grant-a",
          amountMinor: 100, restoredMinor, grant: { accountId: "account-a",
            status: "AVAILABLE", expiresAt: new Date("2027-09-24T00:00:00Z") } }] } }] :
        [{ quantity: 1 }] },
    loyaltyRedemptionAllocation: { updateMany: async ({ data }: { data: {
      restoredMinor: { increment: number } } }) => {
      restoredMinor += data.restoredMinor.increment; return { count: 1 };
    } },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
    } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await restoreRefundedLoyalty(tx, "refund-a", "order-a",
    new Date("2026-09-24T00:00:00Z")), 50);
  assert.deepEqual(created.map(entry => [entry.event, entry.amountMinor]),
    [["REDEEM_RESTORED", 50]]);
  assert.equal(await restoreRefundedLoyalty(tx, "refund-a", "order-a",
    new Date("2026-09-24T00:00:00Z")), 0);
});

test("refund of expired redeemed credit records restoration and matching expiration", async () => {
  const created: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [{ id: "account-a" }],
    refundItemAllocation: { findMany: async ({ where }: { where: Record<string, unknown> }) =>
      "refundOperationId" in where ? [{ orderItemId: "item-a", orderItem: { quantity: 1,
        loyaltyRedemptionAllocations: [{ id: "allocation-a", grantId: "grant-a",
          amountMinor: 100, restoredMinor: 0, grant: { accountId: "account-a",
            status: "EXPIRED", expiresAt: new Date("2026-09-23T00:00:00Z") } }] } }] :
        [{ quantity: 1 }] },
    loyaltyRedemptionAllocation: { updateMany: async () => ({ count: 1 }) },
    loyaltyLedgerEntry: {
      create: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); },
      findMany: async () => [{ event: "EARN_AVAILABLE", amountMinor: 100 },
        { event: "REDEEM", amountMinor: -100 },
        ...created.map(entry => ({ event: entry.event, amountMinor: entry.amountMinor }))],
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await restoreRefundedLoyalty(tx, "refund-a", "order-a",
    new Date("2026-09-24T00:00:00Z")), 100);
  assert.deepEqual(created.map(entry => [entry.event, entry.amountMinor]), [
    ["REDEEM_RESTORED", 100], ["EXPIRED", -100],
  ]);
});

test("mixed seller and platform redemption restores each original grant without cross-funding", async () => {
  const created: Record<string, unknown>[] = [];
  const restored = new Map<string, number>();
  const allocations = [
    { id: "seller-allocation", grantId: "seller-grant", amountMinor: 600,
      grant: { accountId: "buyer-account", fundingSource: "SELLER_RESERVE", status: "AVAILABLE", expiresAt: null } },
    { id: "platform-allocation", grantId: "platform-grant", amountMinor: 400,
      grant: { accountId: "buyer-account", fundingSource: "PLATFORM_ADMIN", status: "AVAILABLE", expiresAt: null } },
  ];
  const tx = {
    $queryRaw: async () => [{ id: "buyer-account" }],
    refundItemAllocation: { findMany: async ({ where }: { where: Record<string, unknown> }) =>
      "refundOperationId" in where ? [{ orderItemId: "item-a", orderItem: { quantity: 2,
        loyaltyRedemptionAllocations: allocations.map(allocation => ({ ...allocation,
          restoredMinor: restored.get(allocation.id) ?? 0 })) } }] : [{ quantity: 1 }] },
    loyaltyRedemptionAllocation: { updateMany: async ({ where, data }: { where: { id: string },
      data: { restoredMinor: { increment: number } } }) => {
      restored.set(where.id, (restored.get(where.id) ?? 0) + data.restoredMinor.increment);
      return { count: 1 };
    } },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
    } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await restoreRefundedLoyalty(tx, "refund-mixed", "order-mixed"), 500);
  assert.deepEqual(created.map(entry => [entry.grantId, entry.event, entry.amountMinor]), [
    ["seller-grant", "REDEEM_RESTORED", 300],
    ["platform-grant", "REDEEM_RESTORED", 200],
  ]);
  assert.equal(await restoreRefundedLoyalty(tx, "refund-mixed", "order-mixed"), 0);
});
