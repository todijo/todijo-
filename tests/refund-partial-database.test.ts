import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCheckout, processStripeEvent } from "../lib/payments";
import { assertRefundSelection, ensureRefundOperation, processRefundOperation,
  RefundSelectionError } from "../lib/refund-lifecycle";
import type { StripeEvent } from "../lib/stripe";
import { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding } from "../lib/loyalty-admin-adjustments";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;

test("disposable DB partial refund restores only one unit's cash and loyalty", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const buyer = await db.user.findUniqueOrThrow({ where: { email: "buyer@review.local" } });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
    const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
    const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } } });
    const suffix = randomUUID().slice(0, 12);
    const product = await db.product.create({ data: {
      name: `LOCAL REVIEW partial refund ${suffix}`, slug: `local-partial-refund-${suffix}`,
      description: "Disposable partial refund financial lifecycle fixture.",
      price: "25.00", category: "women--outerwear--blazers", stock: 3,
      condition: "NEW", images: [], storeId: store.id, status: "PUBLISHED",
      loyaltyEligible: true,
    } });
    const requestId = `refund-${suffix}`;
    const fundingReference = `local_refund_${suffix}`;
    await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
      storeId: store.id, amountMinor: 1_000, reference: fundingReference,
      reason: "Disposable local refund test funding only", fundingSource: "PLATFORM_ADMIN" });
    await attestPlatformLoyaltyFunding(db, verifier.id, {
      reference: fundingReference, evidenceReference: `local_journal_${suffix}`,
      note: "Disposable local test treasury attestation only" });
    const sessionId = `cs_test_refund_${suffix}`;
    const checkout = await createCheckout(db, buyer.id, requestId,
      [{ productId: product.id, quantity: 2 }],
      async () => ({ id: sessionId, url: `https://checkout.stripe.test/${suffix}` }),
      "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
        redeemByStore: { [store.id]: 1_000 },
        retrieveConnectedAccount: async id => ({ id, object: "account",
          details_submitted: true, charges_enabled: true, payouts_enabled: true }) });
    assert.ok(checkout.orderId);
    const paid = await processStripeEvent(db, { id: `evt_test_refund_${suffix}`,
      type: "checkout.session.completed", livemode: false,
      data: { object: { id: sessionId, payment_intent: `pi_test_refund_${suffix}`,
        payment_status: "paid", client_reference_id: checkout.orderId,
        metadata: { orderId: checkout.orderId }, currency: "eur",
        amount_subtotal: 4_000, amount_total: 4_000,
        total_details: { amount_shipping: 0, amount_tax: 0 },
        shipping_details: { address: { country: "FR" } } } } } as StripeEvent);
    assert.deepEqual(paid, { paid: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: checkout.orderId },
      include: { items: true } });
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.items[0].loyaltyRedeemedMinor, 1_000);
    const request = await db.refundRequest.create({ data: { orderId: order.id,
      buyerId: buyer.id, reason: "LOCAL REVIEW partial refund", status: "ADMIN_APPROVED",
      reviewedById: admin.id, reviewedAt: new Date() } });
    const itemQuantities = { [order.items[0].id]: 1 };
    await assert.rejects(assertRefundSelection(db, request.id,
      { [order.items[0].id]: 3 }), RefundSelectionError);
    await assertRefundSelection(db, request.id, itemQuantities);
    const operation = await ensureRefundOperation(db, request.id, admin.id,
      { itemQuantities });
    assert.equal(operation.merchandiseAmountMinor, 2_500);
    assert.equal(operation.cashMerchandiseMinor, 2_000);
    assert.equal(operation.loyaltyRestoredMinor, 500);
    let submitted = 0;
    const submit = async (input: { amount: number }) => {
      submitted += 1;
      assert.equal(input.amount, 2_000);
      return { id: `re_test_refund_${suffix}` };
    };
    const result = await processRefundOperation(db, operation.id, new Date(),
      submit as Parameters<typeof processRefundOperation>[3]);
    assert.equal("refunded" in result && result.refunded, true);
    assert.equal(submitted, 1);
    assert.deepEqual(await processRefundOperation(db, operation.id, new Date(),
      submit as Parameters<typeof processRefundOperation>[3]), { idempotent: true });
    assert.equal(submitted, 1);
    const finalized = await db.refundOperation.findUniqueOrThrow({ where: { id: operation.id },
      include: { itemAllocations: true, groupAllocations: true } });
    assert.equal(finalized.status, "COMPLETED");
    assert.equal(finalized.itemAllocations[0].quantity, 1);
    assert.equal(finalized.groupAllocations[0].loyaltyRestoredMinor, 500);
    assert.equal(finalized.groupAllocations[0].loyaltyReserveReversalMinor, 40);
    const group = await db.orderGroup.findFirstOrThrow({ where: { orderId: order.id } });
    assert.equal(group.refundedMerchandiseMinor, 2_500);
    assert.equal(group.refundedCashMerchandiseMinor, 2_000);
    assert.equal(group.loyaltyReserveReversedMinor, 40);
    assert.equal(group.sellerRecoveredMinor, 2_260);
    assert.equal(group.commissionReversedMinor, 200);
    const restored = await db.loyaltyLedgerEntry.aggregate({ where: {
      orderId: order.id, event: "REDEEM_RESTORED" }, _sum: { amountMinor: true } });
    assert.equal(restored._sum.amountMinor, 500);
  } finally {
    await db.$disconnect();
  }
});
