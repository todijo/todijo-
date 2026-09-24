import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { assertLoyaltyAdjustmentConfirmation, issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding,
  cancelPendingPlatformLoyaltyPledge,
  repairSellerLoyaltyEarning,
  revokePlatformLoyaltyCredit } from "../lib/loyalty-admin-adjustments";

test("admin adjustment HTTP confirmations are operation-specific and fail closed", () => {
  const operations = {
    CREDIT: "PLEDGE_PLATFORM_CREDIT", DEBIT: "REVOKE_PLATFORM_CREDIT",
    ATTEST_PLATFORM: "ATTEST_PLATFORM_FUNDING",
    CANCEL_PLATFORM_PLEDGE: "CANCEL_PLATFORM_PLEDGE",
    SELLER_REPAIR: "REPAIR_SELLER_RESERVE",
  };
  for (const [direction, confirmation] of Object.entries(operations)) {
    assert.doesNotThrow(() => assertLoyaltyAdjustmentConfirmation({ direction, confirmation }));
    assert.throws(() => assertLoyaltyAdjustmentConfirmation({ direction,
      confirmation: "PLEDGE_PLATFORM_CREDIT" === confirmation ? "yes" : "PLEDGE_PLATFORM_CREDIT" }),
    { code: "LOYALTY_ADJUSTMENT_CONFIRMATION_REQUIRED" });
  }
  assert.throws(() => assertLoyaltyAdjustmentConfirmation({ direction: "TRANSFER",
    confirmation: "TRANSFER" }), { code: "INVALID_LOYALTY_ADJUSTMENT" });
});

function fixture(enabled = true) {
  const state: { funding: any; attestation: any; grant: any; entries: any[]; notices: any[];
    holds: number; role: string } = {
    funding: null, attestation: null, grant: null, entries: [], notices: [], holds: 0, role: "ADMIN",
  };
  const account = { id: "account_A", buyerId: "buyer_A", storeId: "store_A" };
  const tx: any = {
    user: { findUnique: async ({ where }: any) => where.id.startsWith("admin_")
      ? { id: where.id, role: state.role }
      : { id: "buyer_A", deactivatedAt: null, blockedAt: null, blockExpiresAt: null } },
    store: { findUnique: async () => ({ id: "store_A", status: "ACTIVE" }) },
    loyaltyProgramSettings: { findUnique: async () => ({ enabled, expiryDays: 365 }) },
    loyaltyAccount: { upsert: async () => account },
    loyaltyPlatformFunding: {
      findUnique: async () => state.funding && ({ ...state.funding,
        account, grant: state.grant, attestation: state.attestation }),
      create: async ({ data }: any) => { state.funding = { id: "funding_A", ...data }; return state.funding; },
    },
    loyaltyPlatformFundingAttestation: { create: async ({ data }: any) => {
      state.attestation = data; return data;
    } },
    loyaltyGrant: {
      create: async ({ data }: any) => {
        state.grant = { id: "grant_A", reversedMinor: 0, ...data };
        return state.grant;
      },
      findUnique: async () => state.grant && ({ ...state.grant, account }),
      updateMany: async ({ data }: any) => {
        if (data.reversedMinor) state.grant.reversedMinor += data.reversedMinor.increment;
        if (data.status) state.grant.status = data.status;
        if (data.availableAt) state.grant.availableAt = data.availableAt;
        if (data.expiresAt) state.grant.expiresAt = data.expiresAt;
        return { count: 1 };
      },
    },
    loyaltyLedgerEntry: {
      findUnique: async ({ where }: any) => state.entries.find(row =>
        row.reference === where.reference) ?? null,
      findMany: async () => state.entries.map(row => ({ event: row.event,
        amountMinor: row.amountMinor })),
      create: async ({ data }: any) => { state.entries.push(data); return data; },
    },
    loyaltyRedemptionReservation: { count: async () => state.holds },
    notification: { create: async ({ data }: any) => { state.notices.push(data); return data; } },
    $queryRaw: async () => [{ id: "account_A" }],
  };
  return { state, db: { $transaction: async (callback: any) => callback(tx) } as PrismaClient };
}

const input = { buyerId: "buyer_A", storeId: "store_A", amountMinor: 500,
  reference: "treasury-2026-001", reason: "Documented Todijo goodwill credit",
  fundingSource: "PLATFORM_ADMIN" as const };

test("platform-funded admin credit creates an attributed grant, ledger and audit source once", async () => {
  const { db, state } = fixture();
  const first = await issuePlatformLoyaltyCredit(db, "admin_A", input,
    new Date("2026-09-24"));
  assert.equal(first.idempotent, false);
  assert.equal(state.grant.fundingSource, "PLATFORM_ADMIN");
  assert.equal(state.grant.orderItemId, undefined);
  assert.equal(state.funding.amountMinor, 500);
  assert.equal(state.grant.status, "PENDING");
  assert.equal(state.entries[0].event, "EARN_PENDING");
  assert.equal(state.entries[0].amountMinor, 500);
  assert.equal(state.notices.length, 0);
  const replay = await issuePlatformLoyaltyCredit(db, "admin_A", input);
  assert.equal(replay.idempotent, true);
  assert.equal(state.entries.length, 1);
  const evidence = { reference: input.reference,
    evidenceReference: "journal:treasury:2026-001",
    note: "Independent finance journal evidence checked" };
  await assert.rejects(attestPlatformLoyaltyFunding(db, "admin_A", evidence),
    { message: "INDEPENDENT_VERIFIER_REQUIRED" });
  const attest = await attestPlatformLoyaltyFunding(db, "admin_B", evidence);
  assert.equal(attest.status, "AVAILABLE");
  assert.equal(state.grant.status, "AVAILABLE");
  assert.equal(state.entries[1].event, "ADMIN_ADJUSTMENT");
  assert.equal(state.attestation.verifierId, "admin_B");
  assert.equal(state.notices.length, 1);
  assert.equal((await attestPlatformLoyaltyFunding(db, "admin_B", evidence)).idempotent, true);
  assert.equal(state.entries.length, 2);
});

test("platform issuance fails closed for disabled rollout and wrong database role", async () => {
  const disabled = fixture(false);
  await assert.rejects(issuePlatformLoyaltyCredit(disabled.db, "admin_A", input),
    { message: "LOYALTY_PROGRAM_DISABLED" });
  assert.equal(disabled.state.entries.length, 0);
  const wrongRole = fixture();
  wrongRole.state.role = "SELLER";
  await assert.rejects(issuePlatformLoyaltyCredit(wrongRole.db, "admin_A", input),
    { code: "ADMIN_REQUIRED" });
  assert.equal(wrongRole.state.entries.length, 0);
  await assert.rejects(issuePlatformLoyaltyCredit(disabled.db, "admin_A", {
    ...input, fundingSource: "SELLER_RESERVE" as "PLATFORM_ADMIN",
  }), { message: "INVALID_LOYALTY_ADJUSTMENT" });
});

test("unattested platform pledge can be canceled with immutable, idempotent audit", async () => {
  const { db, state } = fixture();
  await issuePlatformLoyaltyCredit(db, "admin_A", input);
  const cancellation = { reference: input.reference,
    reason: "Treasury funding did not materialize" };
  const canceled = await cancelPendingPlatformLoyaltyPledge(db, "admin_B", cancellation);
  assert.equal(canceled.status, "REVERSED");
  assert.equal(state.grant.status, "REVERSED");
  assert.equal(state.entries[1].event, "EARN_PENDING_REVERSED");
  assert.equal(state.entries[1].amountMinor, -500);
  assert.equal(state.notices.length, 0);
  assert.equal((await cancelPendingPlatformLoyaltyPledge(db, "admin_B",
    cancellation)).idempotent, true);
  assert.equal(state.entries.length, 2);
  await assert.rejects(attestPlatformLoyaltyFunding(db, "admin_C", {
    reference: input.reference, evidenceReference: "journal:cancelled:2026-001",
    note: "This pledge was already cancelled by treasury" }),
  { message: "PLATFORM_FUNDING_MISMATCH" });
});

test("admin debit only revokes unspent platform credit without touching seller reserve", async () => {
  const { db, state } = fixture();
  await issuePlatformLoyaltyCredit(db, "admin_A", input);
  await attestPlatformLoyaltyFunding(db, "admin_B", {
    reference: input.reference, evidenceReference: "journal:treasury:2026-001",
    note: "Independent finance journal evidence checked" });
  const debit = { ...input, amountMinor: 200, grantId: "grant_A",
    reference: "treasury-2026-002", reason: "Reverse part of the documented credit" };
  const first = await revokePlatformLoyaltyCredit(db, "admin_A", debit);
  assert.equal(first.idempotent, false);
  assert.equal(state.grant.reversedMinor, 200);
  assert.equal(state.entries[2].amountMinor, -200);
  const replay = await revokePlatformLoyaltyCredit(db, "admin_A", debit);
  assert.equal(replay.idempotent, true);
  assert.equal(state.entries.length, 3);
  state.holds = 1;
  await assert.rejects(revokePlatformLoyaltyCredit(db, "admin_A", {
    ...debit, reference: "treasury-2026-003" }),
  { message: "LOYALTY_CREDIT_RESERVED" });
  state.holds = 0;
  state.grant.fundingSource = "SELLER_RESERVE";
  await assert.rejects(revokePlatformLoyaltyCredit(db, "admin_A", {
    ...debit, reference: "treasury-2026-004" }),
  { message: "PLATFORM_GRANT_NOT_REVOCABLE" });
});

test("seller-history repair uses only a verified pre-funded seller reserve and is audited once", async () => {
  const state: { grant: any; entry: any; reserve: number } = {
    grant: null, entry: null, reserve: 200,
  };
  const tx: any = {
    user: { findUnique: async () => ({ id: "admin_A", role: "ADMIN" }) },
    orderItem: {
      findUnique: async () => ({ id: "item_A", orderId: "order_A",
        orderGroupId: "group_A", loyaltyEligibleSnapshot: true,
        loyaltyEarnMinor: 200, loyaltyRateBpsSnapshot: 200,
        loyaltyExpiryDaysSnapshot: 365 }),
      aggregate: async () => ({ _sum: { loyaltyEarnMinor: 200 } }),
    },
    order: { findUnique: async () => ({ buyerId: "buyer_A", currency: "EUR",
      paidAt: new Date(), status: "PAID" }) },
    orderGroup: { findUnique: async () => ({ orderId: "order_A", storeId: "store_A",
      loyaltyReserveMinor: state.reserve, itemSubtotalMinor: 10000,
      shippingAmountMinor: 0, platformFeeAmountMinor: 1000,
      sellerNetAmountMinor: 8800 }) },
    refundOperation: { count: async () => 0 },
    loyaltyAccount: { upsert: async () => ({ id: "account_A" }) },
    loyaltyGrant: {
      findUnique: async () => state.grant,
      create: async ({ data }: any) => { state.grant = { id: "grant_A", ...data }; return state.grant; },
    },
    loyaltyLedgerEntry: {
      findUnique: async () => state.entry,
      create: async ({ data }: any) => { state.entry = data; return data; },
    },
    $queryRaw: async () => [{ id: "account_A" }],
  };
  const db = { $transaction: async (callback: any) => callback(tx) } as PrismaClient;
  const correction = { fundingSource: "SELLER_RESERVE" as const,
    orderItemId: "item_A", reference: "seller-repair-001",
    reason: "Verified missing historical seller earning" };
  const first = await repairSellerLoyaltyEarning(db, "admin_A", correction);
  assert.equal(first.fundingSource, "SELLER_RESERVE");
  assert.equal(state.grant.fundingSource, "SELLER_RESERVE");
  assert.equal(state.entry.adminId, "admin_A");
  assert.equal(state.entry.reason, correction.reason);
  assert.equal(state.entry.amountMinor, 200);
  assert.equal((await repairSellerLoyaltyEarning(db, "admin_A", correction)).idempotent, true);
  state.grant = null;
  state.entry = null;
  state.reserve = 0;
  await assert.rejects(repairSellerLoyaltyEarning(db, "admin_A", correction),
    { message: "SELLER_RESERVE_NOT_VERIFIED" });
  assert.equal(state.grant, null);
});
