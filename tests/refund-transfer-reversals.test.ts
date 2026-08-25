import test from "node:test";
import assert from "node:assert/strict";
import { processTransferReversal } from "../lib/refund-lifecycle";
import { processEligibleSellerTransfer } from "../lib/seller-transfers";

function reversalDb() {
  const state: any = { id: "reversal", status: "REQUESTED", stripeReversalId: null, attemptCount: 0, nextAttemptAt: null, amountMinor: 675, currency: "EUR", originalStripeTransferId: "tr_seller_a", idempotencyKey: "seller-reversal:allocation-a", orderGroupId: "group-a", refundGroupAllocation: { refundOperationId: "refund", refundOperation: { orderId: "order" } } };
  const events: any[] = [];
  const db: any = {
    state, events,
    transferReversal: {
      updateMany: async ({ where, data }: any) => {
        if (where.status?.in && !where.status.in.includes(state.status)) return { count: 0 };
        if (where.status === "PROCESSING" && state.status !== "PROCESSING") return { count: 0 };
        Object.assign(state, data, { attemptCount: data.attemptCount?.increment ? state.attemptCount + data.attemptCount.increment : state.attemptCount });
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...state }),
    },
    orderLifecycleEvent: { create: async ({ data }: any) => { events.push(data); } },
    $transaction: async (run: any) => run(db),
  };
  return db;
}

test("post-transfer reversal targets only the persisted original transfer and is idempotent", async () => {
  const db = reversalDb(); let submissions = 0;
  const submit = async (input: any) => { submissions += 1; assert.deepEqual(input, { transferId: "tr_seller_a", amount: 675, idempotencyKey: "seller-reversal:allocation-a" }); return { id: "trr_1" }; };
  const first = await processTransferReversal(db, "reversal", new Date(), submit);
  const duplicate = await processTransferReversal(db, "reversal", new Date(), submit);
  assert.equal((first as any).reversed, true); assert.equal((duplicate as any).idempotent, true);
  assert.equal(submissions, 1); assert.equal(db.state.stripeReversalId, "trr_1"); assert.equal(db.events.length, 1);
});

test("failed reversal remains independently retryable without invoking a buyer refund", async () => {
  const db = reversalDb();
  await assert.rejects(() => processTransferReversal(db, "reversal", new Date(), async () => { throw new Error("insufficient connected balance"); }), /insufficient/);
  assert.equal(db.state.status, "RETRYABLE"); assert.equal(db.state.errorCode, "TRANSFER_REVERSAL_FAILED"); assert.match(db.state.errorMessage, /insufficient/);
});

test("pre-transfer refund reduces the first payout and a full recovery cancels it", async () => {
  for (const [recovered, expected] of [[225, 775], [1000, 0]] as const) {
    const updates: any[] = []; let submitted: any;
    const owner = { id: "seller", stripeAccountId: "acct", sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null };
    const db: any = { orderGroup: {
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({ id: "group", orderId: "order", stripeConnectedAccountId: "acct", sellerNetAmountMinor: 1000, sellerRecoveredMinor: recovered, transferAttemptCount: 1, transferIdempotencyKey: "seller-transfer:order:seller", store: { status: "ACTIVE", owner }, order: { currency: "EUR" } }),
      update: async ({ data }: any) => { updates.push(data); return {}; },
    }, user: { update: async () => ({}) } };
    const result: any = await processEligibleSellerTransfer(db, "group", new Date(), async (input) => { submitted = input; return { id: "tr" }; }, async () => ({ id: "acct", object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: true }));
    if (expected) { assert.equal(submitted.amount, expected); assert.equal(result.transferred, true); }
    else { assert.equal(submitted, undefined); assert.equal(result.cancelled, true); assert.equal(updates[0].transferStatus, "CANCELLED"); }
  }
});

test("ambiguous transfer retry preserves the original amount and idempotency identity", async () => {
  let submitted: any;
  const owner = { id: "seller", stripeAccountId: "acct", sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null };
  const db: any = { orderGroup: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ id: "group", orderId: "order", stripeConnectedAccountId: "acct", sellerNetAmountMinor: 1000, sellerRecoveredMinor: 400, transferAttemptCount: 2, transferIdempotencyKey: "original-key", store: { status: "ACTIVE", owner }, order: { currency: "EUR" } }), update: async () => ({}) }, user: { update: async () => ({}) } };
  await processEligibleSellerTransfer(db, "group", new Date(), async (input) => { submitted = input; return { id: "tr" }; }, async () => ({ id: "acct", object: "account", details_submitted: true, charges_enabled: true, payouts_enabled: true }));
  assert.equal(submitted.amount, 1000); assert.equal(submitted.idempotencyKey, "original-key");
});
