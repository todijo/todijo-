import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { createCheckout, processStripeEvent } from "../lib/payments";

function loyaltyCheckoutFixture(price: string, earningEnabled = true,
  globalEnabled = true, previouslyActivated = false) {
  const state: { order: any; groups: any[]; items: any[]; reservation: any;
    funding: any; stock: number; livePrice: Prisma.Decimal;
    liveEligible: boolean; livePublished: boolean;
    entries: any[]; notifications: any[] } = {
    order: null, groups: [], items: [], reservation: null, funding: null,
    stock: 5, livePrice: new Prisma.Decimal(price), liveEligible: true,
    livePublished: true, entries: [], notifications: [],
  };
  const product: any = { id: "prod_local", name: "Local product", description: null,
    images: [], colors: [], sizes: [], price: new Prisma.Decimal(price),
    currency: "EUR", stock: 5, storeId: "store_A", loyaltyEligible: true,
    variants: [], shippingOverrideEnabled: false,
    store: { id: "store_A", ownerId: "seller_A", name: "Seller A", slug: "seller-a",
      city: "Paris", country: "FR", contactEmail: "seller@example.test", phone: null,
      currency: "EUR", sellerType: "PROFESSIONAL", loyaltyEnabled: earningEnabled,
      loyaltyBlockedAt: null, legalBusinessName: "Seller A", businessRegistrationId: null,
      businessAddress: null, businessPostalCode: null, vatNumber: null,
      shippingEnabled: true, shippingMethodName: "Standard", shippingPrice: new Prisma.Decimal(0),
      shippingFree: true, shippingMinDays: 2, shippingMaxDays: 5,
      shippingCountries: ["FR"], shippingWorldwide: false,
      owner: { stripeAccountId: "acct_seller_A", stripeOnboardingComplete: true,
        stripeChargesEnabled: true },
    },
  };
  const order: any = {
    findUnique: async () => state.order && ({ ...state.order,
      groups: state.groups, loyaltyFundingSnapshot: state.funding,
      items: state.items.map(item => ({ ...item, product: { supplierLink: null } })) }),
    findUniqueOrThrow: async () => {
      if (!state.order) throw new Error("missing order");
      return { ...state.order, items: state.items, groups: state.groups,
        loyaltyFundingSnapshot: state.funding };
    },
    create: async ({ data }: any) => {
      state.items = data.items.create.map((item: any, index: number) => ({
        id: `item_${index}`, orderId: "order_A", orderGroupId: null, ...item,
      }));
      state.order = { id: "order_A", status: "PENDING", stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null, ...data, items: state.items, groups: state.groups };
      return state.order;
    },
    update: async ({ data }: any) => { Object.assign(state.order, data); return state.order; },
  };
  const orderGroup: any = {
    upsert: async ({ create }: any) => {
      const existing = state.groups.find(group => group.groupKey === create.groupKey);
      if (existing) return existing;
      const group = { id: "group_A", ...create };
      state.groups.push(group); return group;
    },
    count: async () => 0,
  };
  const orderItem: any = {
    updateMany: async ({ where, data }: any) => {
      for (const item of state.items) if (where.lineKey.in.includes(item.lineKey))
        item.orderGroupId = data.orderGroupId;
      return { count: state.items.length };
    },
    count: async () => state.items.filter(item => !item.orderGroupId).length,
    findMany: async () => state.items.filter(item => item.loyaltyRedeemedMinor > 0)
      .map(item => ({ id: item.id, loyaltyEligibleSnapshot: item.loyaltyEligibleSnapshot,
        loyaltyRedeemedMinor: item.loyaltyRedeemedMinor })),
  };
  const store: any = {
    findUnique: async () => ({ ownerId: "seller_A" }),
    findUniqueOrThrow: async () => ({ vatStatus: "REGISTERED",
      marketplaceActivatedAt: new Date("2025-01-01"), sellerRiskPolicy: "NORMAL",
      legacyStandardOverrideAt: null, ownerId: "seller_A" }),
  };
  const loyaltyRedemptionReservation: any = {
    findUnique: async () => state.reservation,
    aggregate: async () => ({ _sum: { amountMinor: 0 } }),
    create: async ({ data }: any) => {
      state.reservation = { id: "hold_A", status: "ACTIVE", ...data };
      return state.reservation;
    },
    updateMany: async ({ data }: any) => {
      if (state.reservation?.status !== "ACTIVE") return { count: 0 };
      Object.assign(state.reservation, data); return { count: 1 };
    },
  };
  const loyaltyOrderFundingSnapshot: any = {
    upsert: async ({ create }: any) => {
      state.funding ??= { id: "fund_A", ...create };
      return state.funding;
    },
    update: async ({ data }: any) => { Object.assign(state.funding, data); return state.funding; },
  };
  const tx: any = { order, orderGroup, orderItem, store,
    stripeWebhookEvent: { create: async () => ({}) },
    product: { findMany: async () => [{ id: product.id, loyaltyEligible: true,
      storeId: "store_A", supplierLink: null }],
      updateMany: async ({ where, data }: any) => {
        if (state.stock < where.stock.gte || !state.liveEligible ||
          !state.livePublished ||
          (where.price && !state.livePrice.equals(where.price))) return { count: 0 };
        state.stock -= data.stock.decrement; return { count: 1 };
      } },
    loyaltyProgramSettings: { findUnique: async () => ({ enabled: globalEnabled }) },
    loyaltySettingsChange: { findFirst: async () => previouslyActivated ? { id: "activation-a" } : null },
    loyaltyAccount: { findUnique: async () => ({ id: "account_A" }) },
    loyaltyLedgerEntry: { findMany: async () => [{ event: "EARN_AVAILABLE", amountMinor: 1_000 }],
      create: async ({ data }: any) => { state.entries.push(data); return data; } },
    loyaltyRedemptionReservation, loyaltyOrderFundingSnapshot,
    loyaltyGrant: { findMany: async () => [{ id: "grant_A", entries: [
      { event: "EARN_AVAILABLE", amountMinor: 1_000 } ] }] },
    loyaltyRedemptionAllocation: { create: async ({ data }: any) => data },
    notification: { create: async ({ data }: any) => { state.notifications.push(data); return data; } },
    $queryRaw: async () => [{ id: "locked" }],
  };
  const db: any = { order, orderGroup,
    product: { findMany: async () => [product] }, store,
    user: { findUniqueOrThrow: async () => ({ email: "buyer@example.test",
      firstName: "Buyer", lastName: "Example" }), update: async () => ({}) },
    loyaltyAccount: { findMany: async () => [{ id: "account_A",
      storeId: "store_A", currency: "EUR",
      store: { name: "Seller A", slug: "seller-a" } }] },
    loyaltyLedgerEntry: { findMany: async () => [{ accountId: "account_A",
      event: "EARN_AVAILABLE", amountMinor: 1_000 }] },
    loyaltyRedemptionReservation: { groupBy: async () => [] },
    loyaltyGrant: { findMany: async ({ where }: any) =>
      where.status === "AVAILABLE" ? [{ id: "grant_A", accountId: "account_A",
        orderItemId: "item_A", expiresAt: new Date("2027-09-24"),
        entries: [{ event: "EARN_AVAILABLE", amountMinor: 1_000 }] }] : [] },
    loyaltyProgramSettings: { findUnique: async () => ({ enabled: globalEnabled,
      rateBps: 200, expiryDays: 365 }) },
    loyaltySettingsChange: { findFirst: async () => previouslyActivated ? { id: "activation-a" } : null },
    $transaction: async (callback: any) => callback(tx),
  };
  return { state, db };
}

const connected = { retrieveConnectedAccount: async () => ({ id: "acct_seller_A",
  object: "account" as const, details_submitted: true,
  charges_enabled: true, payouts_enabled: true }) };

test("read-only preview uses checkout pricing and seller-scoped balance without reserving credit", async () => {
  const fixture = loyaltyCheckoutFixture("50.00");
  const preview = await createCheckout(fixture.db, "buyer_A", "preview_req_1",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("Preview must never create a Stripe session"); },
    "FR", undefined, { ...connected, previewOnly: true,
      redeemByStore: { store_A: 1_000 } });
  assert.equal("preview" in preview && preview.preview, true);
  assert.equal(preview.redeemedMinor, 1_000);
  assert.equal(preview.newCashMinor, 4_000);
  assert.deepEqual(preview.stores.map(store => store.maximumUsableMinor), [1_000]);
  assert.equal(fixture.state.order, null);
  assert.equal(fixture.state.reservation, null);
  assert.equal(fixture.state.entries.length, 0);
});

test("partial loyalty holds €10 and asks Stripe to collect only €40", async () => {
  const fixture = loyaltyCheckoutFixture("50.00");
  let stripeInput: any;
  const result = await createCheckout(fixture.db, "buyer_A", "loyalty_req_1",
    [{ productId: "prod_local", quantity: 1 }],
    async input => { stripeInput = input; return { id: "cs_test_loyalty",
      url: "https://checkout.stripe.test/loyalty" }; }, "FR", undefined,
    { ...connected, redeemByStore: { store_A: 1_000 } });
  assert.equal(result.sessionId, "cs_test_loyalty");
  assert.equal(fixture.state.order.status, "PENDING");
  assert.equal(fixture.state.reservation.status, "ACTIVE");
  assert.equal(fixture.state.funding.loyaltyRedeemedMinor, 1_000);
  assert.equal(fixture.state.funding.newCashMinor, 4_000);
  assert.equal(fixture.state.groups[0].loyaltyRedeemedMinor, 1_000);
  assert.equal(fixture.state.items[0].loyaltyRedeemedMinor, 1_000);
  assert.deepEqual(stripeInput.items.map((item: any) => item.unitAmount * item.quantity), [4_000]);
});

test("fully credit-funded order settles without a Stripe session or fake PaymentIntent", async () => {
  const fixture = loyaltyCheckoutFixture("10.00");
  const result = await createCheckout(fixture.db, "buyer_A", "loyalty_req_2",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("Stripe must not be called for zero cash"); },
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  assert.equal(result.sessionId, null);
  assert.equal(result.url, null);
  assert.equal(fixture.state.order.status, "PAID");
  assert.equal(fixture.state.order.stripePaymentIntentId, null);
  assert.equal(fixture.state.funding.status, "LOYALTY_SETTLED");
  assert.equal(fixture.state.reservation.status, "CONSUMED");
  assert.equal(fixture.state.stock, 4);
  assert.deepEqual(fixture.state.entries.map(entry => entry.event), ["REDEEM"]);
  const replay = await createCheckout(fixture.db, "buyer_A", "loyalty_req_2",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("Stripe must not be called on replay"); },
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  assert.equal(replay.reused, true);
  assert.equal(replay.completed, true);
  assert.equal(fixture.state.stock, 4);
  assert.deepEqual(fixture.state.entries.map(entry => entry.event), ["REDEEM"]);
});

test("seller and global earning pauses preserve earlier earned redemption but first-run rollout stays closed", async () => {
  const prior = loyaltyCheckoutFixture("10.00", false, false, true);
  const preview = await createCheckout(prior.db, "buyer_A", "pause_preview_1",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("preview cannot call Stripe"); }, "FR", undefined,
    { ...connected, previewOnly: true, redeemByStore: { store_A: 1_000 } });
  assert.equal(preview.globalEnabled, false);
  assert.equal(preview.redemptionEnabled, true);
  assert.equal(preview.stores[0].maximumUsableMinor, 1_000);
  const settled = await createCheckout(prior.db, "buyer_A", "pause_redeem_1",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("zero cash cannot call Stripe"); }, "FR", undefined,
    { ...connected, redeemByStore: { store_A: 1_000 } });
  assert.equal(settled.completed, true);
  assert.equal(prior.state.items[0].loyaltyEarnMinor, 0);
  const fresh = loyaltyCheckoutFixture("10.00", false, false, false);
  await assert.rejects(() => createCheckout(fresh.db, "buyer_A", "closed_req_1",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("rollout is closed"); }, "FR", undefined,
    { ...connected, redeemByStore: { store_A: 1_000 } }),
  /LOYALTY_REDEMPTION_UNAVAILABLE/);
});

test("zero-cash retry that waited for an order lock observes the first settlement", async () => {
  const fixture = loyaltyCheckoutFixture("10.00");
  await createCheckout(fixture.db, "buyer_A", "loyalty_req_race",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("zero cash must not call Stripe"); },
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  const stockAfterFirstSettlement = fixture.state.stock;
  const entryCountAfterFirstSettlement = fixture.state.entries.length;
  // The retry started while the first checkout was still pending. Its order
  // lock is granted only after that first checkout reaches PAID.
  fixture.state.order.status = "PENDING";
  fixture.state.funding.status = "PENDING_CASH";
  fixture.state.reservation.status = "ACTIVE";
  let transactions = 0;
  const originalTransaction = fixture.db.$transaction;
  fixture.db.$transaction = async (callback: any) => {
    transactions++;
    if (transactions === 2) {
      fixture.state.order.status = "PAID";
      fixture.state.funding.status = "LOYALTY_SETTLED";
    }
    return originalTransaction(callback);
  };
  const retry = await createCheckout(fixture.db, "buyer_A", "loyalty_req_race",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("retry must not call Stripe"); },
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  assert.equal(retry.completed, true);
  assert.equal(retry.reused, true);
  assert.equal(fixture.state.stock, stockAfterFirstSettlement);
  assert.equal(fixture.state.entries.length, entryCountAfterFirstSettlement);
});

test("zero-cash checkout rejects a source price change before consuming stock or credit", async () => {
  const fixture = loyaltyCheckoutFixture("10.00");
  let transactions = 0;
  const originalTransaction = fixture.db.$transaction;
  fixture.db.$transaction = async (callback: any) => {
    transactions++;
    if (transactions === 2) fixture.state.livePrice = new Prisma.Decimal("11.00");
    return originalTransaction(callback);
  };
  await assert.rejects(() => createCheckout(fixture.db, "buyer_A", "loyalty_req_price",
    [{ productId: "prod_local", quantity: 1 }],
    async () => { throw new Error("zero cash must not call Stripe"); },
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } }),
  /CHECKOUT_PRODUCT_CHANGED/);
  assert.equal(fixture.state.stock, 5);
  assert.equal(fixture.state.entries.length, 0);
  assert.equal(fixture.state.order.status, "PENDING");
});

for (const change of ["stock", "eligibility", "publication"] as const) {
  test(`zero-cash checkout rejects changed ${change} before consuming credit`, async () => {
    const fixture = loyaltyCheckoutFixture("10.00");
    let transactions = 0;
    const originalTransaction = fixture.db.$transaction;
    fixture.db.$transaction = async (callback: any) => {
      transactions++;
      if (transactions === 2) {
        if (change === "stock") fixture.state.stock = 0;
        if (change === "eligibility") fixture.state.liveEligible = false;
        if (change === "publication") fixture.state.livePublished = false;
      }
      return originalTransaction(callback);
    };
    await assert.rejects(() => createCheckout(fixture.db, "buyer_A", `req_${change}_zero`,
      [{ productId: "prod_local", quantity: 1 }],
      async () => { throw new Error("zero cash must not call Stripe"); },
      "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } }),
    /CHECKOUT_PRODUCT_CHANGED/);
    assert.equal(fixture.state.entries.length, 0);
    assert.equal(fixture.state.order.status, "PENDING");
  });
}

test("verified partial-cash webhook consumes held credit only after exact Stripe amount match", async () => {
  const fixture = loyaltyCheckoutFixture("50.00", false);
  await createCheckout(fixture.db, "buyer_A", "loyalty_req_3",
    [{ productId: "prod_local", quantity: 1 }],
    async () => ({ id: "cs_test_partial", url: "https://checkout.stripe.test/partial" }),
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  const event: any = { id: "evt_loyalty_partial", type: "checkout.session.completed",
    data: { object: { id: "cs_test_partial", payment_status: "paid",
      payment_intent: "pi_test_partial", amount_total: 4_000, currency: "eur",
      metadata: { orderId: "order_A" },
      shipping_details: { address: { country: "FR" } },
      total_details: { amount_shipping: 0, amount_tax: 0 },
    } } };
  const result = await processStripeEvent(fixture.db, event);
  assert.deepEqual(result, { paid: true });
  assert.equal(fixture.state.order.status, "PAID");
  assert.equal(fixture.state.reservation.status, "CONSUMED");
  assert.equal(fixture.state.funding.status, "LOYALTY_SETTLED");
  assert.equal(fixture.state.stock, 4);
  assert.deepEqual(fixture.state.entries.map(entry => entry.event), ["REDEEM"]);
});

test("mismatched Stripe amount cannot consume loyalty or mark the order paid", async () => {
  const fixture = loyaltyCheckoutFixture("50.00", false);
  await createCheckout(fixture.db, "buyer_A", "loyalty_req_4",
    [{ productId: "prod_local", quantity: 1 }],
    async () => ({ id: "cs_test_mismatch", url: "https://checkout.stripe.test/mismatch" }),
    "FR", undefined, { ...connected, redeemByStore: { store_A: 1_000 } });
  const event: any = { id: "evt_loyalty_mismatch", type: "checkout.session.completed",
    data: { object: { id: "cs_test_mismatch", payment_status: "paid",
      payment_intent: "pi_test_mismatch", amount_total: 5_000, currency: "eur",
      metadata: { orderId: "order_A" },
    } } };
  await assert.rejects(() => processStripeEvent(fixture.db, event),
    /Stripe total does not match/);
  assert.equal(fixture.state.order.status, "PENDING");
  assert.equal(fixture.state.reservation.status, "ACTIVE");
  assert.equal(fixture.state.stock, 5);
});
