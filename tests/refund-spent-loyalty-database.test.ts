import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCheckout, processStripeEvent } from "../lib/payments";
import { advanceSellerFulfillment } from "../lib/fulfillment";
import { buyerLoyaltySummary, summarizeLoyaltyLedger } from "../lib/loyalty-ledger";
import { ensureRefundOperation, processRefundOperation } from "../lib/refund-lifecycle";
import type { StripeEvent } from "../lib/stripe";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;

test("disposable DB: refund after seller-funded earned credit was fully spent", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const buyer = await db.user.create({ data: {
      firstName: "Local", lastName: "Spent Credit", email: `spent-${suffix}@review.local`,
      emailVerified: true, shippingAddresses: { create: {
        recipientName: "Local Spent Credit", addressLine1: "1 Local Test Street",
        postalCode: "75001", city: "Paris", country: "FR", isDefault: true,
      } },
    } });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
    const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
    const store = await db.store.findFirstOrThrow({ where: { ownerId: seller.id } });
    const settings = await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } });
    assert.equal(settings.enabled, true, "disposable loyalty fixture must be enabled");
    assert.equal(store.loyaltyEnabled, true, "disposable seller fixture must opt in");
    const originalProduct = await db.product.create({ data: {
      name: `LOCAL REVIEW earned credit ${suffix}`, slug: `local-earned-${suffix}`,
      description: "Disposable spent-credit refund fixture.", price: "100.00",
      category: "women--outerwear--blazers", stock: 2, condition: "NEW",
      images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
    } });
    const connectedAccount = async (id: string) => ({ id, object: "account" as const,
      details_submitted: true, charges_enabled: true, payouts_enabled: true });
    const originalSession = `cs_test_spent_${suffix}`;
    const original = await createCheckout(db, buyer.id, `earned-${suffix}`,
      [{ productId: originalProduct.id, quantity: 1 }],
      async () => ({ id: originalSession, url: `https://checkout.stripe.test/${suffix}` }),
      "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
        retrieveConnectedAccount: connectedAccount });
    assert.ok(original.orderId);
    assert.deepEqual(await processStripeEvent(db, { id: `evt_spent_${suffix}`,
      type: "checkout.session.completed", livemode: false,
      data: { object: { id: originalSession, payment_intent: `pi_test_spent_${suffix}`,
        payment_status: "paid", client_reference_id: original.orderId,
        metadata: { orderId: original.orderId }, currency: "eur",
        amount_subtotal: 10_000, amount_total: 10_000,
        total_details: { amount_shipping: 0, amount_tax: 0 },
        shipping_details: { address: { country: "FR" } } } } } as StripeEvent), { paid: true });
    const pending = await db.loyaltyGrant.findFirstOrThrow({ where: {
      orderItem: { orderId: original.orderId }, fundingSource: "SELLER_RESERVE",
    } });
    assert.ok(pending.amountMinor > 0);
    assert.equal(pending.status, "PENDING");
    for (const action of ["PAID", "PROCESSING", "SHIPPED"] as const) {
      await advanceSellerFulfillment(db, seller.id, original.orderId, action);
    }
    const available = await db.loyaltyGrant.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(available.status, "AVAILABLE");
    const summaryBeforeSpend = await buyerLoyaltySummary(db, buyer.id);
    assert.equal(summaryBeforeSpend.availableMinor, pending.amountMinor);

    const spendProduct = await db.product.create({ data: {
      name: `LOCAL REVIEW spend credit ${suffix}`, slug: `local-spend-${suffix}`,
      description: "Disposable spent-credit redemption fixture.",
      price: (pending.amountMinor / 100).toFixed(2),
      category: "women--outerwear--blazers", stock: 2, condition: "NEW",
      images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
    } });
    let providerCalls = 0;
    const spent = await createCheckout(db, buyer.id, `spent-${suffix}`,
      [{ productId: spendProduct.id, quantity: 1 }],
      async () => { providerCalls++; throw new Error("zero-cash must not call provider"); },
      "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
        redeemByStore: { [store.id]: pending.amountMinor },
        retrieveConnectedAccount: connectedAccount });
    assert.equal(providerCalls, 0);
    assert.equal(spent.completed, true);
    assert.ok(spent.orderId);
    const paidSpend = await db.order.findUniqueOrThrow({ where: { id: spent.orderId } });
    assert.equal(paidSpend.status, "PAID");
    const redemption = await db.loyaltyRedemptionAllocation.findFirstOrThrow({ where: {
      grantId: pending.id, orderItem: { orderId: spent.orderId },
    } });
    assert.equal(redemption.amountMinor, pending.amountMinor);
    const summaryAfterSpend = await buyerLoyaltySummary(db, buyer.id);
    assert.equal(summaryAfterSpend.availableMinor, 0);
    assert.equal(summaryAfterSpend.owedMinor, 0);

    const request = await db.refundRequest.create({ data: {
      orderId: original.orderId, buyerId: buyer.id,
      reason: "LOCAL REVIEW original order refunded after credit spend",
      status: "ADMIN_APPROVED", reviewedById: admin.id, reviewedAt: new Date(),
    } });
    const operation = await ensureRefundOperation(db, request.id, admin.id);
    assert.equal(operation.totalAmountMinor, 10_000);
    let refundsSubmitted = 0;
    const submit = async (input: { amount: number }) => {
      refundsSubmitted++;
      assert.equal(input.amount, 10_000);
      return { id: `re_test_spent_${suffix}` };
    };
    const result = await processRefundOperation(db, operation.id, new Date(),
      submit as Parameters<typeof processRefundOperation>[3]);
    assert.equal("refunded" in result && result.refunded, true);
    assert.deepEqual(await processRefundOperation(db, operation.id, new Date(),
      submit as Parameters<typeof processRefundOperation>[3]), { idempotent: true });
    assert.equal(refundsSubmitted, 1);

    const reversed = await db.loyaltyGrant.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(reversed.status, "REVERSED");
    assert.equal(reversed.reversedMinor, pending.amountMinor);
    assert.equal(await db.loyaltyRedemptionAllocation.count({ where: {
      grantId: pending.id, orderItem: { orderId: spent.orderId },
    } }), 1);
    const entries = await db.loyaltyLedgerEntry.findMany({ where: { grantId: pending.id } });
    for (const event of ["EARN_PENDING", "EARN_AVAILABLE", "REDEEM", "EARN_REVERSED"] as const)
      assert.equal(entries.filter(entry => entry.event === event).length, 1, event);
    assert.equal(entries.find(entry => entry.event === "EARN_REVERSED")?.amountMinor,
      -pending.amountMinor);
    const balance = summarizeLoyaltyLedger(entries);
    assert.equal(balance.availableMinor, 0);
    assert.equal(balance.owedMinor, pending.amountMinor);
    assert.equal(balance.signedMinor, -pending.amountMinor);
    const summaryAfterRefund = await buyerLoyaltySummary(db, buyer.id);
    assert.equal(summaryAfterRefund.availableMinor, 0);
    assert.equal(summaryAfterRefund.owedMinor, pending.amountMinor);
    const finalOperation = await db.refundOperation.findUniqueOrThrow({ where: { id: operation.id } });
    assert.equal(finalOperation.status, "COMPLETED");
    const originalGroup = await db.orderGroup.findFirstOrThrow({ where: { orderId: original.orderId } });
    assert.equal(originalGroup.loyaltyReserveReversedMinor, pending.amountMinor);
    assert.equal(originalGroup.refundedCashMerchandiseMinor, 10_000);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: spent.orderId } })).status, "PAID");
  } finally { await db.$disconnect(); }
});
