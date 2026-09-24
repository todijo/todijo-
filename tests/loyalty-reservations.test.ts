import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { consumePaidLoyaltyReservation, reserveLoyaltyCredit, releaseLoyaltyReservations } from "../lib/loyalty-reservations";

const now = new Date("2026-09-24T00:00:00Z");
const expiresAt = new Date("2026-09-24T01:00:00Z");
const request = { buyerId: "buyer-a", storeId: "store-a", checkoutRequestId: "checkout-a",
  currency: "EUR" as const, requestedMinor: 500, eligibleMerchandiseMinor: 1000, now, expiresAt };

function fixture(options: { buyerId?: string; storeId?: string; creditMinor?: number;
  activeMinor?: number; grantExpired?: boolean;
  existing?: { amountMinor: number; status: "ACTIVE" | "RELEASED"; expiresAt: Date } } = {}) {
  const created: Record<string, unknown>[] = [];
  const released: Record<string, unknown>[] = [];
  const aggregates: Record<string, unknown>[] = [];
  const tx = {
    loyaltyAccount: { findUnique: async ({ where }: { where: { buyerId_storeId_currency: {
      buyerId: string; storeId: string } } }) =>
      where.buyerId_storeId_currency.buyerId === (options.buyerId ?? "buyer-a") &&
      where.buyerId_storeId_currency.storeId === (options.storeId ?? "store-a") ? { id: "account-a" } : null },
    $queryRaw: async () => [{ id: "account-a" }],
    loyaltyRedemptionReservation: {
      findUnique: async () => options.existing ? { id: "reservation-a", ...options.existing } : null,
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        aggregates.push(where);
        return { _sum: { amountMinor: options.activeMinor ?? 0 } };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data); return { id: "reservation-a", ...data };
      },
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        released.push(where); return { count: 1 };
      },
    },
    loyaltyLedgerEntry: { findMany: async () => [
      { event: "EARN_AVAILABLE", amountMinor: options.creditMinor ?? 1000 },
    ] },
    loyaltyGrant: { findMany: async () => options.grantExpired ? [] : [
      { entries: [{ event: "EARN_AVAILABLE",
        amountMinor: options.creditMinor ?? 1000 }] },
    ] },
  } as unknown as Prisma.TransactionClient;
  return { tx, created, released, aggregates };
}

test("reservation is buyer/store scoped, subtracts other active holds and is server capped", async () => {
  const state = fixture({ activeMinor: 300 });
  const result = await reserveLoyaltyCredit(state.tx, request);
  assert.equal(result.amountMinor, 500);
  assert.equal(state.created.length, 1);
  assert.deepEqual(state.aggregates[0], { accountId: "account-a", status: "ACTIVE" });
  await assert.rejects(reserveLoyaltyCredit(fixture({ activeMinor: 600 }).tx, request),
    { code: "LOYALTY_BALANCE_INSUFFICIENT" });
  await assert.rejects(reserveLoyaltyCredit(state.tx, { ...request, requestedMinor: 1100 }),
    { code: "INVALID_LOYALTY_REDEMPTION" });
});

test("other buyers and other stores cannot spend this account", async () => {
  const state = fixture();
  await assert.rejects(reserveLoyaltyCredit(state.tx, { ...request, buyerId: "buyer-b" }),
    { code: "LOYALTY_BALANCE_UNAVAILABLE" });
  await assert.rejects(reserveLoyaltyCredit(state.tx, { ...request, storeId: "store-b" }),
    { code: "LOYALTY_BALANCE_UNAVAILABLE" });
});

test("a due grant cannot be reserved before the asynchronous expiry job runs",async()=>{
  const state=fixture({grantExpired:true});
  await assert.rejects(reserveLoyaltyCredit(state.tx,request),
    {code:"LOYALTY_BALANCE_INSUFFICIENT"});
  assert.equal(state.created.length,0);
});

test("same checkout retry is idempotent but changed amount or expired hold cannot replay", async () => {
  const existing = { amountMinor: 500, status: "ACTIVE" as const, expiresAt };
  const state = fixture({ existing });
  assert.equal((await reserveLoyaltyCredit(state.tx, request)).id, "reservation-a");
  assert.equal(state.created.length, 0);
  await assert.rejects(reserveLoyaltyCredit(state.tx, { ...request, requestedMinor: 400 }),
    { code: "LOYALTY_CHECKOUT_REQUEST_FINALIZED" });
  await assert.rejects(reserveLoyaltyCredit(fixture({ existing: { ...existing, expiresAt: now } }).tx, request),
    { code: "LOYALTY_CHECKOUT_REQUEST_FINALIZED" });
});

test("release remains scoped to the verified buyer and request", async () => {
  const state = fixture();
  await releaseLoyaltyReservations(state.tx, "buyer-a", "checkout-a");
  assert.deepEqual(state.released[0], { checkoutRequestId: "checkout-a",
    account: { buyerId: "buyer-a" }, status: "ACTIVE" });
});

test("paid redemption consumes earliest-expiring grants and records source-attributed debits", async () => {
  const entries: Record<string, unknown>[] = [];
  const allocations: Record<string, unknown>[] = [];
  let consumed = false;
  const tx = {
    loyaltyAccount: { findUnique: async () => ({ id: "account-a" }) },
    $queryRaw: async () => [{ id: "account-a" }],
    order: { findUnique: async () => ({ buyerId: "buyer-a", checkoutRequestId: "checkout-a", status: "PAID",
      groups: [{ loyaltyRedeemedMinor: 500 }] }) },
    orderItem: { findMany: async () => [{ id: "item-a", loyaltyEligibleSnapshot: true,
      loyaltyRedeemedMinor: 500 }] },
    loyaltyRedemptionReservation: {
      findUnique: async () => ({ id: "hold-a", amountMinor: 500, status: consumed ? "CONSUMED" : "ACTIVE" }),
      updateMany: async () => { consumed = true; return { count: 1 }; },
    },
    loyaltyGrant: { findMany: async () => [
      { id: "old", entries: [{ event: "EARN_PENDING", amountMinor: 400 },
        { event: "EARN_AVAILABLE", amountMinor: 400 }, { event: "REDEEM", amountMinor: -100 }] },
      { id: "new", entries: [{ event: "EARN_AVAILABLE", amountMinor: 300 }] },
    ] },
    loyaltyRedemptionAllocation: { create: async ({ data }: { data: Record<string, unknown> }) => {
      allocations.push(data);
    } },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => { entries.push(data); } },
  } as unknown as Prisma.TransactionClient;
  const input = { buyerId: "buyer-a", storeId: "store-a", checkoutRequestId: "checkout-a",
    orderId: "order-a", expectedMinor: 500 };
  const result = await consumePaidLoyaltyReservation(tx, input);
  assert.deepEqual(result.grants, [{ orderItemId: "item-a", grantId: "old", amountMinor: 300 },
    { orderItemId: "item-a", grantId: "new", amountMinor: 200 }]);
  assert.deepEqual(allocations, result.grants);
  assert.deepEqual(entries.map(entry => [entry.reference, entry.amountMinor]), [
    ["redeem:order-a:item-a:old", -300], ["redeem:order-a:item-a:new", -200],
  ]);
  assert.equal(consumed, true);
  await assert.rejects(consumePaidLoyaltyReservation(tx, input),
    { code: "LOYALTY_RESERVATION_MISMATCH" });
});

test("paid redemption rejects a buyer, store, order or grant mismatch", async () => {
  let debits = 0;
  const tx = {
    loyaltyAccount: { findUnique: async ({ where }: { where: { buyerId_storeId_currency: {
      buyerId: string; storeId: string } } }) =>
      where.buyerId_storeId_currency.buyerId === "buyer-a" &&
      where.buyerId_storeId_currency.storeId === "store-a" ? { id: "account-a" } : null },
    $queryRaw: async () => [{ id: "account-a" }],
    order: { findUnique: async () => ({ buyerId: "buyer-a", checkoutRequestId: "checkout-a", status: "PAID",
      groups: [{ loyaltyRedeemedMinor: 500 }] }) },
    orderItem: { findMany: async () => [{ id: "item-a", loyaltyEligibleSnapshot: true,
      loyaltyRedeemedMinor: 500 }] },
    loyaltyRedemptionReservation: { findUnique: async () => ({
      id: "hold-a", amountMinor: 500, status: "ACTIVE" }) },
    loyaltyGrant: { findMany: async () => [{ id: "grant-a",
      entries: [{ event: "EARN_AVAILABLE", amountMinor: 400 }] }] },
    loyaltyRedemptionAllocation: { create: async () => { debits++; } },
    loyaltyLedgerEntry: { create: async () => { debits++; } },
  } as unknown as Prisma.TransactionClient;
  const input = { buyerId: "buyer-a", storeId: "store-a", checkoutRequestId: "checkout-a",
    orderId: "order-a", expectedMinor: 500 };
  await assert.rejects(consumePaidLoyaltyReservation(tx, { ...input, buyerId: "buyer-b" }),
    { code: "LOYALTY_BALANCE_UNAVAILABLE" });
  await assert.rejects(consumePaidLoyaltyReservation(tx, { ...input, storeId: "store-b" }),
    { code: "LOYALTY_BALANCE_UNAVAILABLE" });
  await assert.rejects(consumePaidLoyaltyReservation(tx, { ...input, checkoutRequestId: "checkout-b" }),
    { code: "LOYALTY_PAID_ORDER_MISMATCH" });
  await assert.rejects(consumePaidLoyaltyReservation(tx, { ...input, expectedMinor: 300 }),
    { code: "LOYALTY_PAID_ORDER_MISMATCH" });
  await assert.rejects(consumePaidLoyaltyReservation(tx, input),
    { code: "LOYALTY_GRANT_BALANCE_MISMATCH" });
  assert.equal(debits, 0);
});
