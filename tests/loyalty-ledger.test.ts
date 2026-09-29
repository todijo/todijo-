import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buyerLoyaltySummary, summarizeLoyaltyLedger } from "../lib/loyalty-ledger";

test("pending credit is not spendable; available credit accounts for reservations", () => {
  assert.deepEqual(summarizeLoyaltyLedger([
    { event: "EARN_PENDING", amountMinor: 200 },
    { event: "EARN_PENDING_REVERSED", amountMinor: -100 },
    { event: "EARN_AVAILABLE", amountMinor: 500 },
  ], 300), { signedMinor: 500, availableMinor: 200, owedMinor: 0, reservedMinor: 300 });
});

test("redemption, restoration, expiry and reversals are additive ledger events", () => {
  assert.deepEqual(summarizeLoyaltyLedger([
    { event: "EARN_AVAILABLE", amountMinor: 1000 },
    { event: "REDEEM", amountMinor: -500 },
    { event: "REDEEM_RESTORED", amountMinor: 200 },
    { event: "EXPIRED", amountMinor: -100 },
    { event: "EARN_REVERSED", amountMinor: -100 },
  ]), { signedMinor: 500, availableMinor: 500, owedMinor: 0, reservedMinor: 0 });
});

test("a refund after credit was spent produces controlled debt, not a corrupted balance", () => {
  assert.deepEqual(summarizeLoyaltyLedger([
    { event: "EARN_AVAILABLE", amountMinor: 200 },
    { event: "REDEEM", amountMinor: -200 },
    { event: "EARN_REVERSED", amountMinor: -200 },
  ]), { signedMinor: -200, availableMinor: 0, owedMinor: 200, reservedMinor: 0 });
});

test("wrong event signs and malformed reservations fail closed", () => {
  assert.throws(() => summarizeLoyaltyLedger([{ event: "REDEEM", amountMinor: 100 }]));
  assert.throws(() => summarizeLoyaltyLedger([{ event: "EARN_AVAILABLE", amountMinor: -100 }]));
  assert.throws(() => summarizeLoyaltyLedger([{ event: "EARN_PENDING_REVERSED", amountMinor: 100 }]));
  assert.throws(() => summarizeLoyaltyLedger([], -1));
});

test("buyer expiring-soon amount uses only the grant's unspent value", async () => {
  const expiresAt = new Date("2026-10-10T00:00:00Z");
  let reservationWhere: Record<string, unknown> | null = null;
  const db = {
    loyaltyAccount: { findMany: async () => [{ id: "account-a", storeId: "store-a", currency: "EUR",
      store: { name: "Store A", slug: "store-a" } }] },
    loyaltyLedgerEntry: { findMany: async ({ select }: { select: Record<string, boolean> }) =>
      select.id ? [] : [{ accountId: "account-a", event: "EARN_AVAILABLE", amountMinor: 200 }] },
    loyaltyRedemptionReservation: { groupBy: async ({ where }: { where: Record<string, unknown> }) => {
      reservationWhere = where; return [{ accountId: "account-a", _sum: { amountMinor: 25 } }];
    } },
    loyaltyGrant: { findMany: async ({ where }: { where: { status: string } }) =>
      where.status === "PENDING" ? [] : [{ id: "grant-a", accountId: "account-a",
        orderItemId: "item-a", expiresAt, entries: [
          { event: "EARN_AVAILABLE", amountMinor: 200 },
          { event: "REDEEM", amountMinor: -50 },
        ] }] },
  } as unknown as PrismaClient;
  const summary = await buyerLoyaltySummary(db, "buyer-a", new Date("2026-09-24T00:00:00Z"));
  assert.equal(summary.expiringSoonMinor, 150);
  assert.equal(summary.expiringSoon[0].storeId, "store-a");
  assert.equal(summary.expiringSoon[0].expiresAt, expiresAt);
  assert.equal(summary.stores[0].reservedMinor, 25);
  assert.equal(summary.stores[0].availableMinor, 125);
  assert.equal(summary.reservedMinor, 25);
  assert.deepEqual(reservationWhere, { accountId: { in: ["account-a"] }, status: "ACTIVE" });
});
