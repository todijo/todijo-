import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { recordPaidLoyaltyEarning } from "../lib/loyalty-earning";

const order = (reserveMinor = 200) => ({
  id: "order-1", buyerId: "buyer-1", currency: "EUR",
  groups: [{ id: "group-a", storeId: "store-a", loyaltyReserveMinor: reserveMinor }],
  items: [{ id: "item-1", orderGroupId: "group-a", loyaltyEarnMinor: 200,
    loyaltyRateBpsSnapshot: 200, loyaltyExpiryDaysSnapshot: 365,
    loyaltyEligibleSnapshot: true }],
});

test("paid webhook records pending grant and ledger entry against buyer/store reserve", async () => {
  const writes: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const tx = {
    loyaltyAccount: { upsert: async ({ create }: { create: Record<string, unknown> }) => {
      writes.push({ kind: "account", data: create }); return { id: "account-a" };
    } },
    loyaltyGrant: { create: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push({ kind: "grant", data }); return { id: "grant-a" };
    } },
    loyaltyLedgerEntry: { create: async ({ data }: { data: Record<string, unknown> }) => {
      writes.push({ kind: "ledger", data }); return { id: "entry-a" };
    } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await recordPaidLoyaltyEarning(tx, order()), 1);
  assert.equal(writes[0].data.buyerId, "buyer-1");
  assert.equal(writes[0].data.storeId, "store-a");
  assert.equal(writes[1].data.amountMinor, 200);
  assert.equal(writes[2].data.event, "EARN_PENDING");
  assert.equal(writes[2].data.reference, "earn:pending:item-1");
});

test("reserve mismatch and missing order item evidence abort the webhook", async () => {
  const tx = {} as Prisma.TransactionClient;
  await assert.rejects(recordPaidLoyaltyEarning(tx, order(199)), /LOYALTY_RESERVE_MISMATCH/);
  const invalid = order();
  invalid.items[0].loyaltyEligibleSnapshot = false;
  await assert.rejects(recordPaidLoyaltyEarning(tx, invalid), /LOYALTY_GRANT_EVIDENCE_INVALID/);
});
