import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createMobileSession } from "../lib/mobile-session";
import { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding } from "../lib/loyalty-admin-adjustments";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true &&
  process.env.TODIJO_LOCAL_CHECKOUT_HTTP_E2E === "enabled" &&
  process.env.NODE_ENV !== "production";
const origin = "http://127.0.0.1:3001";

test("disposable HTTP checkout uses test-ready seller and recovers over-balance and stale keys", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const buyer = await db.user.create({ data: {
      firstName: "Local", lastName: "HTTP Checkout", email: `http-checkout-${suffix}@review.local`,
      emailVerified: true, shippingAddresses: { create: {
        recipientName: "Local HTTP Checkout", addressLine1: "1 Local Test Street",
        postalCode: "75001", city: "Paris", country: "FR", isDefault: true,
      } },
    } });
    const store = await db.store.findFirstOrThrow({ where: { owner: { email: "seller@review.local" } },
      include: { owner: { select: { stripeAccountId: true } } } });
    assert.match(store.owner.stripeAccountId ?? "", /^acct_test_local_/);
    const product = await db.product.create({ data: {
      name: `LOCAL REVIEW HTTP checkout ${suffix}`, slug: `local-http-checkout-${suffix}`,
      description: "Disposable HTTP checkout fixture.", price: "25.00",
      category: "women--outerwear--blazers", stock: 3, condition: "NEW",
      images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
    } });
    const session = await createMobileSession(buyer, { platform: "android" });
    const send = async (requestId: string, displayedUnitPrice = "25.00",
      redeemByStore: Record<string, number> = {}) => {
      const response = await fetch(`${origin}/api/mobile/checkout`, { method: "POST", headers: {
        authorization: `Bearer ${session.accessToken}`, "content-type": "application/json",
      }, body: JSON.stringify({ requestId, shoppingCountry: "FR", buyerCurrency: "EUR",
        locale: "fr", redeemByStore, items: [{ productId: product.id, quantity: 1,
          displayedUnitPrice, displayedCurrency: "EUR" }] }) });
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    };
    const key = `http-${suffix}`;
    const overBalance = await send(key, "25.00", { [store.id]: 100 });
    assert.equal(overBalance.status, 409);
    assert.equal(overBalance.body.code, "LOYALTY_BALANCE_UNAVAILABLE");
    assert.equal(await db.order.count({ where: { buyerId: buyer.id, checkoutRequestId: key } }), 0);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: { checkoutRequestId: key } }), 0);
    const [first, retry] = await Promise.all([send(key), send(key)]);
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.equal(first.body.orderId, retry.body.orderId);
    assert.match(String(first.body.url), /^https:\/\/checkout\.stripe\.test\/local-review\//);
    assert.equal(await db.order.count({ where: { buyerId: buyer.id, checkoutRequestId: key } }), 1);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: { checkoutRequestId: key } }), 0);
    await db.product.update({ where: { id: product.id }, data: { price: "25.01" } });
    const stale = await send(key, "25.01");
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "CHECKOUT_REQUEST_STALE");
    assert.equal(await db.order.count({ where: { buyerId: buyer.id } }), 1);
    const corrected = await send(`fresh-${suffix}`, "25.01");
    assert.equal(corrected.status, 200);
    assert.notEqual(corrected.body.orderId, first.body.orderId);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    assert.equal(await db.loyaltyLedgerEntry.count({ where: { orderId: {
      in: [String(first.body.orderId), String(corrected.body.orderId)],
    } } }), 0);
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
    const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
    const reference = `local_http_funding_${suffix}`;
    await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
      storeId: store.id, amountMinor: 4001, reference,
      reason: "Disposable local HTTP checkout funding only", fundingSource: "PLATFORM_ADMIN" });
    await attestPlatformLoyaltyFunding(db, verifier.id, { reference,
      evidenceReference: `local_journal_${suffix}`,
      note: "Disposable local HTTP funding attestation" });
    const mixed = await send(`mixed-${suffix}`, "25.01", { [store.id]: 1000 });
    assert.equal(mixed.status, 200, JSON.stringify(mixed.body));
    assert.match(String(mixed.body.url), /^https:\/\/checkout\.stripe\.test\/local-review\//);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `mixed-${suffix}`, status: "ACTIVE",
    } }), 1);
    const zeroCash = await send(`zero-${suffix}`, "25.01", { [store.id]: 2501 });
    assert.equal(zeroCash.status, 200, JSON.stringify(zeroCash.body));
    assert.equal(zeroCash.body.completed, true);
    assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
      checkoutRequestId: `zero-${suffix}`, status: "ACTIVE",
    } }), 0);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 2);
  } finally { await db.$disconnect(); }
});

test("disposable HTTP provider decline cancels pending order and releases the loyalty hold",
  { skip: !process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") ||
    process.env.TODIJO_LOCAL_CHECKOUT_HTTP_REJECT_E2E !== "enabled" ||
    process.env.NODE_ENV === "production" }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Decline",
        email: `http-decline-${suffix}@review.local`, emailVerified: true,
        shippingAddresses: { create: { recipientName: "Local Decline",
          addressLine1: "1 Local Test Street", postalCode: "75001", city: "Paris",
          country: "FR", isDefault: true } } } });
      const store = await db.store.findFirstOrThrow({ where: {
        owner: { email: "seller@review.local" },
      } });
      const product = await db.product.create({ data: {
        name: `LOCAL REVIEW decline ${suffix}`, slug: `local-decline-${suffix}`,
        description: "Disposable HTTP provider rejection fixture.", price: "25.00",
        category: "women--outerwear--blazers", stock: 2, condition: "NEW",
        images: [], storeId: store.id, status: "PUBLISHED", loyaltyEligible: true,
      } });
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
      const reference = `local_http_decline_${suffix}`;
      await issuePlatformLoyaltyCredit(db, admin.id, { buyerId: buyer.id,
        storeId: store.id, amountMinor: 500, reference,
        reason: "Disposable local provider decline only", fundingSource: "PLATFORM_ADMIN" });
      await attestPlatformLoyaltyFunding(db, verifier.id, { reference,
        evidenceReference: `local_journal_${suffix}`,
        note: "Disposable local decline funding attestation" });
      const session = await createMobileSession(buyer, { platform: "android" });
      const key = `decline-${suffix}`;
      const response = await fetch(`${origin}/api/mobile/checkout`, { method: "POST", headers: {
        authorization: `Bearer ${session.accessToken}`, "content-type": "application/json",
      }, body: JSON.stringify({ requestId: key, shoppingCountry: "FR", buyerCurrency: "EUR",
        locale: "fr", redeemByStore: { [store.id]: 500 },
        items: [{ productId: product.id, quantity: 1, displayedUnitPrice: "25.00",
          displayedCurrency: "EUR" }] }) });
      assert.equal(response.status, 503);
      assert.equal((await response.json() as { code: string }).code,
        "LOCAL_CHECKOUT_PROVIDER_REJECTED");
      const order = await db.order.findUniqueOrThrow({ where: {
        buyerId_checkoutRequestId: { buyerId: buyer.id, checkoutRequestId: key },
      } });
      assert.equal(order.status, "CANCELLED");
      assert.equal(order.stripeCheckoutSessionId, null);
      assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
        checkoutRequestId: key, status: "ACTIVE",
      } }), 0);
      assert.equal(await db.loyaltyRedemptionReservation.count({ where: {
        checkoutRequestId: key, status: "RELEASED",
      } }), 1);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 2);
    } finally { await db.$disconnect(); }
  });
