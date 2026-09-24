import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { releaseDeliveredLoyalty } from "../lib/loyalty-availability";

function setup(status = "DELIVERED", refundStatus: string | null = null) {
  const entries: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];
  const tx = {
    order: { findUnique: async () => ({ status, paidAt: new Date(), buyerId: "buyer-a" }) },
    refundRequest: { findUnique: async () => refundStatus ? { status: refundStatus } : null },
    refundOperation: { findFirst: async () => null },
    loyaltyGrant: { findMany: async () => [{ id: "grant-a", accountId: "account-a",
      amountMinor: 200, reversedMinor: 50, expiryDays: 365, orderItemId: "item-a" }],
      updateMany: async () => ({ count: 1 }) },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => {
      entries.push(data); return { id: "event-a" };
    } },
    notification: { create: async ({ data }: { data: Record<string, unknown> }) => {
      notifications.push(data); return { id: "notification-a" };
    } },
  } as unknown as Prisma.TransactionClient;
  return { tx, entries, notifications };
}

test("verified delivery releases only unrefunded pending credit and notifies buyer", async () => {
  const state = setup();
  const now = new Date("2026-09-24T00:00:00Z");
  assert.equal(await releaseDeliveredLoyalty(state.tx, "order-a", now), 150);
  assert.equal(state.entries[0].event, "EARN_AVAILABLE");
  assert.equal(state.entries[0].amountMinor, 150);
  assert.equal(state.notifications.length, 1);
});

test("pre-delivery or unresolved refund never makes credit spendable", async () => {
  const unshipped = setup("SHIPPED");
  const refundOpen = setup("DELIVERED", "PENDING");
  assert.equal(await releaseDeliveredLoyalty(unshipped.tx, "order-a"), 0);
  assert.equal(await releaseDeliveredLoyalty(refundOpen.tx, "order-a"), 0);
  assert.equal(unshipped.entries.length + refundOpen.entries.length, 0);
});
