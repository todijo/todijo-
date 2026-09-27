import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCheckout, CheckoutError } from "../lib/payments";
import { expireCheckoutOrder } from "../lib/checkout-expiration";
import { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding } from "../lib/loyalty-admin-adjustments";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;

test("disposable DB confirmed expiry releases loyalty and makes the old request key stale", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const buyer = await db.user.create({ data: {
      firstName: "Local", lastName: "Expiry", email: `expiry-${suffix}@review.local`,
      emailVerified: true, shippingAddresses: { create: {
        recipientName: "Local Expiry", addressLine1: "1 Local Test Street",
        postalCode: "75001", city: "Paris", country: "FR", isDefault: true,
      } },
    } });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
    const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
    const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } } });
    const product = await db.product.create({ data: {
      name: `LOCAL REVIEW expiry ${suffix}`, slug: `local-expiry-${suffix}`,
      description: "Disposable checkout expiry fixture.", price: "25.00",
      category: "women--outerwear--blazers", stock: 2, condition: "NEW",
      images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
    } });
    const reference = `local_expiry_${suffix}`;
    await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
      storeId: store.id, amountMinor: 500, reference,
      reason: "Disposable checkout expiration fixture only", fundingSource: "PLATFORM_ADMIN" });
    await attestPlatformLoyaltyFunding(db, verifier.id, { reference,
      evidenceReference: `local_journal_${suffix}`, note: "Disposable fixture only" });
    const sessionId = `cs_test_expiry_${suffix}`;
    const item = [{ productId: product.id, quantity: 1 }];
    const pricing = { buyerCurrency: "EUR", stripeMode: "test" as const,
      redeemByStore: { [store.id]: 500 }, retrieveConnectedAccount: async (id: string) => ({
        id, object: "account" as const, details_submitted: true,
        charges_enabled: true, payouts_enabled: true,
      }) };
    let providerCalls = 0;
    const provider = async () => { providerCalls++;
      return { id: providerCalls === 1 ? sessionId : `cs_test_expiry_retry_${suffix}`,
        url: `https://checkout.stripe.test/${suffix}/${providerCalls}` };
    };
    const first = await createCheckout(db, buyer.id, `expire-${suffix}`, item,
      provider, "FR", undefined, pricing);
    assert.ok(first.orderId);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `expire-${suffix}`, status: "ACTIVE",
    } }), 1);
    await db.order.update({ where: { id: first.orderId }, data: {
      checkoutExpiresAt: new Date(Date.now() - 60_000),
    } });
    await assert.rejects(createCheckout(db, buyer.id, `expire-${suffix}`, item,
      provider, "FR", undefined, pricing), (error: unknown) =>
      error instanceof CheckoutError && error.message === "CHECKOUT_EXPIRY_PENDING");
    assert.equal(providerCalls, 1);
    const expiry = await expireCheckoutOrder(db, first.orderId, new Date(),
      async id => ({ id, status: "expired", payment_status: "unpaid",
        payment_intent: null, client_reference_id: first.orderId! }));
    assert.equal(expiry.outcome, "EXPIRED");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.orderId } })).status, "CANCELLED");
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `expire-${suffix}`, status: "ACTIVE",
    } }), 0);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `expire-${suffix}`, status: "RELEASED",
    } }), 1);
    await assert.rejects(createCheckout(db, buyer.id, `expire-${suffix}`, item,
      provider, "FR", undefined, pricing), (error: unknown) =>
      error instanceof CheckoutError && error.message === "CHECKOUT_REQUEST_STALE");
    assert.equal((await expireCheckoutOrder(db, first.orderId, new Date(),
      async () => { throw new Error("must not query provider twice"); })).outcome, "ALREADY_EXPIRED");
    assert.equal(providerCalls, 1);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 2);
    const fresh = await createCheckout(db, buyer.id, `retry-${suffix}`, item,
      provider, "FR", undefined, pricing);
    assert.ok(fresh.orderId);
    assert.notEqual(fresh.orderId, first.orderId);
    assert.equal(providerCalls, 2);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `retry-${suffix}`, status: "ACTIVE",
    } }), 1);
  } finally { await db.$disconnect(); }
});
