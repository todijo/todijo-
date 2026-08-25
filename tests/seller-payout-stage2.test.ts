import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { markSellerGroupsShipmentVerified, processDueSellerTransfers, processEligibleSellerTransfer, releaseHighRiskSellerTransfer } from "../lib/seller-transfers";

const day = 86_400_000;
const shippedAt = new Date("2026-08-25T12:00:00.000Z");

function shipmentDb(policies: Record<string, "AUTOMATIC" | "HIGH_RISK_HOLD">, standardStores: string[] = []) {
  const groups = new Map(Object.keys(policies).map((storeId) => [storeId, { id: `group_${storeId}`, orderId: "order_1", groupKey: `store:${storeId}`, kind: "MARKETPLACE", shipmentVerifiedAt: null as Date | null, transferStatus: "WAITING_FOR_SHIPMENT", maturitySnapshot: "NEW", transferEligibleAt: null as Date | null }]));
  const writes: any[] = [];
  const db: any = {
    store: { findUniqueOrThrow: async ({ where }: any) => ({ marketplaceActivatedAt: new Date(shippedAt.getTime() - 60 * day), sellerRiskPolicy: policies[where.id], legacyStandardOverrideAt: standardStores.includes(where.id) ? new Date(shippedAt.getTime() - day) : null }) },
    orderGroup: {
      count: async () => 0,
      findUnique: async ({ where }: any) => {
        const key = where.orderId_groupKey?.groupKey;
        return key ? groups.get(key.slice(6)) ?? null : null;
      },
      updateMany: async ({ where, data }: any) => {
        const group = [...groups.values()].find((candidate) => candidate.id === where.id);
        if (!group || group.shipmentVerifiedAt || group.transferStatus !== "WAITING_FOR_SHIPMENT") return { count: 0 };
        Object.assign(group, data); writes.push({ groupId: group.id, data }); return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: any) => [...groups.values()].find((candidate) => candidate.id === where.id),
    },
  };
  return { db, groups, writes };
}

test("STANDARD verified shipment releases only the authenticated seller group and duplicate events are idempotent", async () => {
  const { db, groups, writes } = shipmentDb({ sellerA: "AUTOMATIC", sellerB: "AUTOMATIC" }, ["sellerA", "sellerB"]);
  const first = await markSellerGroupsShipmentVerified(db, "order_1", ["sellerA"], shippedAt);
  const duplicate = await markSellerGroupsShipmentVerified(db, "order_1", ["sellerA"], new Date(shippedAt.getTime() + 1000));
  assert.equal(first.length, 1); assert.equal(duplicate.length, 0); assert.equal(writes.length, 1);
  assert.equal(groups.get("sellerA")?.transferStatus, "READY");
  assert.equal(groups.get("sellerA")?.transferEligibleAt?.toISOString(), shippedAt.toISOString());
  assert.equal(groups.get("sellerB")?.transferStatus, "WAITING_FOR_SHIPMENT");
});

test("NEW seller reserve is persisted from authoritative shipment time and becomes due after exactly seven days", async () => {
  const { db, groups } = shipmentDb({ sellerNew: "AUTOMATIC" });
  await markSellerGroupsShipmentVerified(db, "order_1", ["sellerNew"], shippedAt);
  const group = groups.get("sellerNew")!;
  assert.equal(group.transferStatus, "RESERVE_PERIOD");
  assert.equal(group.transferEligibleAt?.toISOString(), new Date(shippedAt.getTime() + 7 * day).toISOString());

  const processed: string[] = [];
  const workerDb: any = {
    orderGroup: {
      updateMany: async ({ where, data }: any) => {
        if (where.transferEligibleAt.lte >= group.transferEligibleAt!) Object.assign(group, data);
        return { count: 1 };
      },
      findMany: async ({ where }: any) => group.transferStatus === "READY" && where.transferEligibleAt.lte >= group.transferEligibleAt! ? [{ id: group.id }] : [],
    },
  };
  assert.equal((await processDueSellerTransfers(workerDb, new Date(shippedAt.getTime() + 7 * day - 1), 25, async () => { throw new Error("must not run"); })).processed, 0);
  await processDueSellerTransfers(workerDb, new Date(shippedAt.getTime() + 7 * day), 25, async (_db, id) => { processed.push(id); return { transferred: true, id: "tr_new" }; });
  assert.deepEqual(processed, [group.id]);
});

test("HIGH_RISK shipment is held until an authorized, audited, idempotent release", async () => {
  const { db: shipment, groups } = shipmentDb({ risky: "HIGH_RISK_HOLD" });
  await markSellerGroupsShipmentVerified(shipment, "order_1", ["risky"], shippedAt);
  const group = groups.get("risky")!;
  assert.equal(group.transferStatus, "MANUAL_ACTION_REQUIRED");
  assert.equal(group.transferEligibleAt, null);

  const events: any[] = [];
  const tx: any = {
    orderGroup: {
      findUnique: async () => ({ ...group, maturitySnapshot: "HIGH_RISK", stripeTransferId: null }),
      updateMany: async ({ data }: any) => { if (group.transferStatus !== "MANUAL_ACTION_REQUIRED") return { count: 0 }; Object.assign(group, data); return { count: 1 }; },
    },
    orderLifecycleEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  const adminDb: any = {
    user: { findUnique: async ({ where }: any) => where.id === "admin" ? { id: "admin", role: "ADMIN" } : { id: where.id, role: "SELLER" } },
    $transaction: async (callback: any) => callback(tx),
  };
  await assert.rejects(() => releaseHighRiskSellerTransfer(adminDb, { userId: "seller" }, group.id, "Reviewed and approved by risk."));
  const released = await releaseHighRiskSellerTransfer(adminDb, { userId: "admin" }, group.id, "Reviewed and approved by risk.", shippedAt);
  const repeated = await releaseHighRiskSellerTransfer(adminDb, { userId: "admin" }, group.id, "Reviewed and approved by risk.", shippedAt);
  assert.equal(released.changed, true); assert.equal(repeated.idempotent, true); assert.equal(events.length, 1);
  assert.equal(events[0].type, "SELLER_TRANSFER_RISK_RELEASED");
});

test("transfer execution is claimed once, uses immutable seller net, and blocks suspended sellers", async () => {
  let claimed = false; let submissions = 0; const updates: any[] = [];
  const owner = { id: "seller", stripeAccountId: "acct_ready", sellerSuspendedAt: null as Date | null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null };
  const db: any = {
    orderGroup: {
      updateMany: async () => claimed ? { count: 0 } : (claimed = true, { count: 1 }),
      findUniqueOrThrow: async () => ({ id: "group", orderId: "order", stripeConnectedAccountId: "acct_ready", sellerNetAmountMinor: 1234, transferIdempotencyKey: "seller-transfer:order:store", store: { status: "ACTIVE", owner }, order: { currency: "EUR" } }),
      update: async ({ data }: any) => { updates.push(data); return data; },
    },
    user: { update: async () => ({}) },
  };
  const submit = async (input: any) => { submissions += 1; assert.equal(input.amount, 1234); assert.equal(input.idempotencyKey, "seller-transfer:order:store"); return { id: "tr_once" }; };
  const retrieve = async () => ({ id: "acct_ready", object: "account" as const, details_submitted: true, charges_enabled: true, payouts_enabled: true });
  const [first, duplicate] = await Promise.all([processEligibleSellerTransfer(db, "group", shippedAt, submit, retrieve), processEligibleSellerTransfer(db, "group", shippedAt, submit, retrieve)]);
  assert.equal(submissions, 1); assert.equal([first, duplicate].filter((result) => "idempotent" in result).length, 1); assert.equal(updates.at(-1).stripeTransferId, "tr_once");

  claimed = false; owner.sellerSuspendedAt = shippedAt; submissions = 0;
  await assert.rejects(() => processEligibleSellerTransfer(db, "group", shippedAt, submit, retrieve), /not eligible/);
  assert.equal(submissions, 0); assert.equal(updates.at(-1).transferStatus, "RETRYABLE");
});

test("durable worker and release routes are secret/admin guarded while CJ remains structurally excluded", () => {
  const worker = readFileSync(join(process.cwd(), "app/api/internal/seller-transfers/route.ts"), "utf8");
  const release = readFileSync(join(process.cwd(), "app/api/admin/order-groups/[groupId]/transfer-release/route.ts"), "utf8");
  const transfers = readFileSync(join(process.cwd(), "lib/seller-transfers.ts"), "utf8");
  const fulfillment = readFileSync(join(process.cwd(), "lib/fulfillment.ts"), "utf8");
  const payments = readFileSync(join(process.cwd(), "lib/payments.ts"), "utf8");
  assert.match(worker, /SELLER_TRANSFER_CRON_SECRET/); assert.match(worker, /timingSafeEqual/);
  assert.match(release, /readSession/); assert.match(transfers, /requireAdmin/);
  assert.match(fulfillment, /markSellerGroupsShipmentVerified\(tx, order\.id, storeIds/);
  assert.doesNotMatch(payments, /processEligibleSellerTransfer|markSellerGroupsShipmentVerified/);
  assert.match(transfers, /kind: "MARKETPLACE"/); assert.doesNotMatch(transfers, /CJ_PLATFORM.*createStripeTransfer/);
});
