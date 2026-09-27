import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCheckout, processStripeEvent } from "../lib/payments";
import { advanceSellerFulfillment } from "../lib/fulfillment";
import { buyerLoyaltySummary } from "../lib/loyalty-ledger";
import { issuePlatformLoyaltyCredit, attestPlatformLoyaltyFunding } from "../lib/loyalty-admin-adjustments";
import { ensureRefundOperation, processRefundOperation } from "../lib/refund-lifecycle";
import type { StripeEvent } from "../lib/stripe";

const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true;
const connected = async (id: string) => ({ id, object: "account" as const,
  details_submitted: true, charges_enabled: true, payouts_enabled: true });

async function fixture(db: PrismaClient, label: string) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const buyer = await db.user.create({ data: { firstName: "Local", lastName: label,
    email: `refund-${label}-${suffix}@review.local`, emailVerified: true,
    shippingAddresses: { create: { recipientName: `Local ${label}`,
      addressLine1: "1 Local Test Street", postalCode: "75001", city: "Paris",
      country: "FR", isDefault: true } } } });
  const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
  const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
  const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
  return { suffix, buyer, seller, admin, verifier, store };
}

async function product(db: PrismaClient, input: { suffix: string; storeId: string;
  label: string; price: string; loyaltyEligible: boolean }) {
  return db.product.create({ data: { name: `LOCAL REVIEW ${input.label} ${input.suffix}`,
    slug: `local-${input.label}-${input.suffix}`,
    description: "Disposable refund funding matrix fixture.", price: input.price,
    category: "women--outerwear--blazers", stock: 3, condition: "NEW",
    images: [], storeId: input.storeId, status: "PUBLISHED",
    loyaltyEligible: input.loyaltyEligible } });
}

async function platformCredit(db: PrismaClient, f: Awaited<ReturnType<typeof fixture>>, amountMinor: number) {
  const reference = `local_funding_${f.suffix}`;
  await issuePlatformLoyaltyCredit(db, f.admin.id, { buyerId: f.buyer.id,
    storeId: f.store.id, amountMinor, reference,
    reason: "Disposable refund funding matrix only", fundingSource: "PLATFORM_ADMIN" });
  await attestPlatformLoyaltyFunding(db, f.verifier.id, { reference,
    evidenceReference: `local_journal_${f.suffix}`, note: "Disposable funding attestation only" });
}

async function checkout(db: PrismaClient, f: Awaited<ReturnType<typeof fixture>>,
  item: { id: string }, label: string, quantity: number, redeemMinor = 0) {
  const sessionId = `cs_test_${label}_${f.suffix}`;
  const result = await createCheckout(db, f.buyer.id, `${label}-${f.suffix}`,
    [{ productId: item.id, quantity }],
    async () => ({ id: sessionId, url: `https://checkout.stripe.test/${label}/${f.suffix}` }),
    "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
      ...(redeemMinor ? { redeemByStore: { [f.store.id]: redeemMinor } } : {}),
      retrieveConnectedAccount: connected });
  assert.ok(result.orderId);
  return { ...result, sessionId };
}

async function pay(db: PrismaClient, orderId: string, sessionId: string,
  amountMinor: number, suffix: string) {
  assert.deepEqual(await processStripeEvent(db, { id: `evt_${sessionId}`,
    type: "checkout.session.completed", livemode: false,
    data: { object: { id: sessionId, payment_intent: `pi_test_${suffix}`,
      payment_status: "paid", client_reference_id: orderId,
      metadata: { orderId }, currency: "eur", amount_subtotal: amountMinor,
      amount_total: amountMinor,
      total_details: { amount_shipping: 0, amount_tax: 0 },
      shipping_details: { address: { country: "FR" } } } } } as StripeEvent), { paid: true });
}

async function refund(db: PrismaClient, f: Awaited<ReturnType<typeof fixture>>,
  orderId: string, cashMinor: number, quantity?: number) {
  const request = await db.refundRequest.create({ data: { orderId, buyerId: f.buyer.id,
    reason: "LOCAL REVIEW funding matrix refund", status: "ADMIN_APPROVED",
    reviewedById: f.admin.id, reviewedAt: new Date() } });
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
  const operation = await ensureRefundOperation(db, request.id, f.admin.id,
    quantity == null ? {} : { itemQuantities: { [item.id]: quantity } });
  assert.equal(operation.totalAmountMinor, cashMinor);
  let submits = 0;
  const submit = async (input: { amount: number }) => { submits++;
    assert.equal(input.amount, cashMinor); return { id: `re_test_${f.suffix}` };
  };
  const result = await processRefundOperation(db, operation.id, new Date(),
    submit as Parameters<typeof processRefundOperation>[3]);
  assert.equal(cashMinor === 0 ? "fundedRefund" in result : "refunded" in result, true);
  assert.deepEqual(await processRefundOperation(db, operation.id, new Date(),
    submit as Parameters<typeof processRefundOperation>[3]), { idempotent: true });
  assert.equal(submits, cashMinor === 0 ? 0 : 1);
  assert.equal((await db.refundOperation.findUniqueOrThrow({ where: { id: operation.id } })).status,
    "COMPLETED");
  return operation;
}

test("disposable DB cash-only full refund has one cash provider call and no loyalty ledger", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const f = await fixture(db, "cash");
    const item = await product(db, { suffix: f.suffix, storeId: f.store.id,
      label: "cash", price: "25.00", loyaltyEligible: false });
    const order = await checkout(db, f, item, "cash", 1);
    await pay(db, order.orderId!, order.sessionId, 2_500, f.suffix);
    const operation = await refund(db, f, order.orderId!, 2_500);
    assert.equal(operation.loyaltyRestoredMinor, 0);
    assert.equal(await db.loyaltyGrant.count({ where: { orderItem: { orderId: order.orderId! } } }), 0);
    assert.equal(await db.loyaltyLedgerEntry.count({ where: { orderId: order.orderId! } }), 0);
    const group = await db.orderGroup.findFirstOrThrow({ where: { orderId: order.orderId! } });
    assert.equal(group.refundedCashMerchandiseMinor, 2_500);
    assert.equal(group.loyaltyReserveReversedMinor, 0);
  } finally { await db.$disconnect(); }
});

test("disposable DB zero-cash platform-funded full refund restores credit without a provider call", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const f = await fixture(db, "zero");
    await platformCredit(db, f, 2_500);
    const item = await product(db, { suffix: f.suffix, storeId: f.store.id,
      label: "zero", price: "25.00", loyaltyEligible: true });
    const order = await checkout(db, f, item, "zero", 1, 2_500);
    assert.equal(order.completed, true);
    assert.equal(order.sessionId != null, true);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.orderId! } })).status, "PAID");
    const operation = await refund(db, f, order.orderId!, 0);
    assert.equal(operation.loyaltyRestoredMinor, 2_500);
    const summary = await buyerLoyaltySummary(db, f.buyer.id);
    assert.equal(summary.availableMinor, 2_500);
    const restored = await db.loyaltyLedgerEntry.aggregate({ where: {
      orderId: order.orderId!, event: "REDEEM_RESTORED" }, _sum: { amountMinor: true } });
    assert.equal(restored._sum.amountMinor, 2_500);
    assert.equal(await db.loyaltyRedemptionAllocation.count({ where: {
      orderItem: { orderId: order.orderId! }, restoredMinor: 2_500,
    } }), 1);
  } finally { await db.$disconnect(); }
});

test("disposable DB mixed seller/platform funding restores both buckets on a cash-plus-loyalty refund", { skip: !disposable }, async () => {
  const db = new PrismaClient();
  try {
    const f = await fixture(db, "mixed");
    const earningProduct = await product(db, { suffix: f.suffix, storeId: f.store.id,
      label: "earn", price: "100.00", loyaltyEligible: true });
    const earnedOrder = await checkout(db, f, earningProduct, "earn", 1);
    await pay(db, earnedOrder.orderId!, earnedOrder.sessionId, 10_000, `${f.suffix}_earn`);
    for (const action of ["PAID", "PROCESSING", "SHIPPED"] as const)
      await advanceSellerFulfillment(db, f.seller.id, earnedOrder.orderId!, action);
    const sellerGrant = await db.loyaltyGrant.findFirstOrThrow({ where: {
      orderItem: { orderId: earnedOrder.orderId! }, fundingSource: "SELLER_RESERVE",
    } });
    assert.equal(sellerGrant.status, "AVAILABLE");
    await platformCredit(db, f, 300);
    const item = await product(db, { suffix: f.suffix, storeId: f.store.id,
      label: "mixed", price: "25.00", loyaltyEligible: true });
    const redeemedMinor = sellerGrant.amountMinor + 200;
    assert.ok(redeemedMinor > sellerGrant.amountMinor && redeemedMinor <= sellerGrant.amountMinor + 300);
    const order = await checkout(db, f, item, "mixed", 1, redeemedMinor);
    const cashMinor = 2_500 - redeemedMinor;
    await pay(db, order.orderId!, order.sessionId, cashMinor, `${f.suffix}_mixed`);
    const allocations = await db.loyaltyRedemptionAllocation.findMany({ where: {
      orderItem: { orderId: order.orderId! },
    }, include: { grant: true } });
    assert.deepEqual(new Set(allocations.map(row => row.grant.fundingSource)),
      new Set(["SELLER_RESERVE", "PLATFORM_ADMIN"]));
    assert.equal(allocations.reduce((sum, row) => sum + row.amountMinor, 0), redeemedMinor);
    const operation = await refund(db, f, order.orderId!, cashMinor);
    assert.equal(operation.loyaltyRestoredMinor, redeemedMinor);
    const restored = await db.loyaltyRedemptionAllocation.findMany({ where: {
      orderItem: { orderId: order.orderId! },
    } });
    assert.equal(restored.reduce((sum, row) => sum + row.restoredMinor, 0), redeemedMinor);
    assert.ok(restored.every(row => row.restoredMinor === row.amountMinor));
    const group = await db.orderGroup.findFirstOrThrow({ where: { orderId: order.orderId! } });
    assert.equal(group.refundedCashMerchandiseMinor, cashMinor);
    assert.equal(group.refundedMerchandiseMinor, 2_500);
    const summary = await buyerLoyaltySummary(db, f.buyer.id);
    assert.equal(summary.availableMinor, sellerGrant.amountMinor + 300);
  } finally { await db.$disconnect(); }
});
