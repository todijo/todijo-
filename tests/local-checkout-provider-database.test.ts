import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCheckout } from "../lib/payments";
import { attestPlatformLoyaltyFunding, issuePlatformLoyaltyCredit } from "../lib/loyalty-admin-adjustments";
import { cancelRejectedLocalCheckout, localCheckoutProvider,
  LocalCheckoutProviderFailure } from "../lib/local-checkout-provider";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;
const local = { NODE_ENV: "test", TODIJO_LOCAL_CHECKOUT_PROVIDER: "enabled",
  TODIJO_LOCAL_CHECKOUT_PROVIDER_OUTCOME: "reject", STRIPE_MODE: "test",
  DATABASE_URL: "postgresql://e2e@127.0.0.1:55432/todijo_e2e?schema=public",
  APP_URL: "http://127.0.0.1:3001" };

test("local provider rejection cancels its audit order and releases loyalty without payment",
  { skip: !disposable }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Checkout",
        email: `buyer-provider-${suffix}@review.local`, emailVerified: true,
        shippingAddresses: { create: { recipientName: "Local Checkout",
          addressLine1: "1 Local Test Street", postalCode: "75001", city: "Paris",
          country: "FR", isDefault: true } } } });
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
      const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } } });
      const product = await db.product.findFirstOrThrow({ where: { storeId: store.id,
        name: { startsWith: "LOCAL REVIEW partial refund" },
        status: "PUBLISHED", variants: { none: {} }, stock: { gte: 1 },
        price: { gte: 1 } } });
      const fundingReference = `local_reject_${suffix}`;
      await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
        storeId: store.id, amountMinor: 100, reference: fundingReference,
        reason: "Disposable provider rejection regression only",
        fundingSource: "PLATFORM_ADMIN" });
      await attestPlatformLoyaltyFunding(db, verifier.id, {
        reference: fundingReference, evidenceReference: `local_journal_${suffix}`,
        note: "Disposable test treasury attestation only" });
      const provider = localCheckoutProvider(local);
      assert.ok(provider);
      const requestId = `local_reject_${suffix}`;
      await assert.rejects(createCheckout(db, buyer.id, requestId,
        [{ productId: product.id, quantity: 1 }], provider.stripeCreate,
        "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
          redeemByStore: { [store.id]: 100 },
          retrieveConnectedAccount: provider.retrieveConnectedAccount }),
      LocalCheckoutProviderFailure);
      assert.equal(await cancelRejectedLocalCheckout(db, buyer.id, requestId, local), true);
      const order = await db.order.findUniqueOrThrow({ where: {
        buyerId_checkoutRequestId: { buyerId: buyer.id,
          checkoutRequestId: requestId } } });
      assert.equal(order.status, "CANCELLED");
      assert.equal(order.stripeCheckoutSessionId, null);
      assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
        checkoutRequestId: requestId, status: "ACTIVE" } }), 0);
      assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
        checkoutRequestId: requestId, status: "RELEASED" } }), 1);
      assert.equal(await db.orderLifecycleEvent.count({ where: { orderId: order.id,
        type: "LOCAL_PROVIDER_REJECTED" } }), 1);
      assert.equal(await cancelRejectedLocalCheckout(db, buyer.id, requestId, local), false);
    } finally { await db.$disconnect(); }
  });
