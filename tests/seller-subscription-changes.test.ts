import assert from "node:assert/strict";
import test from "node:test";
import { requestSellerSubscriptionChange, reconcileSellerSubscriptionChanges, processSellerSubscriptionTransitionEvent, subscriptionChangeOperation, subscriptionChangeKey, type subscriptionChangeProviders } from "../lib/seller-subscription-changes";
import { StripeApiError, StripeTransportError, upgradeSellerStripeSubscription, configureSellerSubscriptionSchedule, type StripeSubscription, type StripeSubscriptionSchedule, type StripeEvent } from "../lib/stripe";
import { updateSellerTeamMember } from "../lib/seller-team";
import { sellerProductQuota } from "../lib/seller-subscription";
import { sellerPlans } from "../lib/seller-plans";

const now = new Date("2026-10-04T12:00:00Z"), boundary = new Date("2026-11-04T12:00:00Z");
const prices = Object.fromEntries(["basic", "plus", "pro"].flatMap(plan => ["monthly", "annual"].map(interval => [`STRIPE_SELLER_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`, `price_${plan}${interval}`])));
async function withPrices(run: () => Promise<void> | void) {
  const previous = Object.fromEntries(Object.keys(prices).map(key => [key, process.env[key]])); Object.assign(process.env, prices);
  try { await run(); } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
function fixture(plan = "basic", interval = "monthly") {
  let local: any = { id: "local", storeId: "store", stripeSubscriptionId: "sub", stripePriceId: `price_${plan}${interval}`, plan, billingInterval: interval, status: "ACTIVE", currentPeriodEnd: boundary, scheduledPlan: null, scheduledBillingInterval: null, scheduledChangeAt: null };
  let changes: any[] = [], queue = Promise.resolve(), next = 0, failPersist = false;
  const live: StripeSubscription = { id: "sub", object: "subscription", customer: "cus", status: "active", collection_method: "charge_automatically", current_period_start: now.getTime() / 1000, current_period_end: boundary.getTime() / 1000, items: { data: [{ id: "si", quantity: 1, price: { id: local.stripePriceId } }] } };
  let schedule: StripeSubscriptionSchedule | null = null, upgrades = 0, creates = 0, configures = 0, releases = 0, mode = "pending";
  const keys: string[] = [], events = new Set<string>();
  function matches(row: any, where: any): boolean { return Object.entries(where).every(([key, value]: [string, any]) => value && typeof value === "object" && "in" in value ? value.in.includes(row[key]) : value && typeof value === "object" && "not" in value ? row[key] !== value.not : row[key] === value); }
  const tx: any = {
    $queryRaw: async () => [],
    store: { findUnique: async () => ({ ownerId: "seller", stripeCustomerId: "cus" }) },
    stripeWebhookEvent: { findUnique: async ({ where }: any) => events.has(where.id) ? { id: where.id } : null, create: async ({ data }: any) => { events.add(data.id); return data; } },
    sellerSubscription: {
      findUnique: async ({ where }: any) => matches(local, where) ? structuredClone(local) : null,
      update: async ({ data }: any) => { Object.assign(local, data); return structuredClone(local); },
    },
    sellerSubscriptionChange: {
      create: async ({ data }: any) => { const row = { id: `change_${++next}`, status: "PREPARED", createdAt: now, stripeInvoiceId: null, ...data }; assert.equal(changes.filter(change => ["PREPARED", "AWAITING_PAYMENT"].includes(change.status)).length, 0); changes.push(row); return structuredClone(row); },
      findFirst: async ({ where }: any) => structuredClone(changes.find(row => matches(row, where)) ?? null),
      findMany: async ({ where }: any) => structuredClone(changes.filter(row => matches(row, where))),
      findUniqueOrThrow: async ({ where, include }: any) => { const row = changes.find(row => matches(row, where)); assert.ok(row); return structuredClone({ ...row, ...(include ? { sellerSubscription: { storeId: "store" } } : {}) }); },
      update: async ({ where, data }: any) => { if (failPersist && (data.stripeInvoiceId || data.status === "SCHEDULED")) { failPersist = false; throw new Error("database unavailable"); } const row = changes.find(row => matches(row, where)); assert.ok(row); Object.assign(row, data); return structuredClone(row); },
      updateMany: async ({ where, data }: any) => { const rows = changes.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    },
  };
  const db: any = { ...tx, $transaction: (callback: any) => { const run = queue.then(async () => { const snapshot = structuredClone({ local, changes, events }); try { return await callback(tx); } catch (error) { local = snapshot.local; changes = snapshot.changes; events.clear(); snapshot.events.forEach(value => events.add(value)); throw error; } }); queue = run.then(() => undefined, () => undefined); return run; } };
  const providers: typeof subscriptionChangeProviders = {
    retrieve: async () => structuredClone(live), invoice: async () => { assert.equal(typeof live.latest_invoice, "object"); return structuredClone(live.latest_invoice! as any); },
    upgrade: async input => {
      assert.equal(changes.find(change => subscriptionChangeKey(change.id, "upgrade") === input.idempotencyKey)?.status, "PREPARED", "PREPARED must be durable before Stripe"); upgrades++; keys.push(input.idempotencyKey);
      if (mode === "timeout-before") throw new StripeTransportError("timeout");
      if (mode === "rejected") throw new StripeApiError("Invalid request", "parameter_unknown", 400);
      live.latest_invoice = { id: "in_upgrade", object: "invoice", subscription: "sub", created: now.getTime() / 1000, billing_reason: "subscription_update", paid: mode === "paid", status: mode === "paid" ? "paid" : "open" };
      if (mode === "paid") live.items!.data![0].price = { id: input.priceId }; else live.pending_update = { expires_at: now.getTime() / 1000 + 3600 };
      if (mode === "timeout-after") throw new StripeTransportError("timeout");
      return structuredClone(live);
    },
    createSchedule: async (_subscription, key) => { creates++; keys.push(key); schedule = { id: "sched", object: "subscription_schedule", subscription: "sub", status: "active", current_phase: { start_date: now.getTime() / 1000, end_date: boundary.getTime() / 1000 }, phases: [{ start_date: now.getTime() / 1000, end_date: boundary.getTime() / 1000, items: [{ price: local.stripePriceId, quantity: 1 }] }], metadata: {} }; live.schedule = schedule.id; return structuredClone(schedule); },
    schedule: async () => { assert.ok(schedule); return structuredClone(schedule); },
    configureSchedule: async input => { configures++; keys.push(input.idempotencyKey); assert.ok(schedule); schedule.metadata = { todijoChangeId: input.changeId }; schedule.phases = [schedule.phases![0], { start_date: input.boundary.getTime() / 1000, items: [{ price: input.targetPriceId, quantity: 1 }] }]; if (mode === "schedule-timeout") throw new StripeTransportError("schedule timeout"); return structuredClone(schedule); },
    release: async (_id, key) => { releases++; keys.push(key); assert.ok(schedule); schedule.status = "released"; live.schedule = null; if (mode === "release-timeout") throw new StripeTransportError("release timeout"); return structuredClone(schedule); },
  };
  const request = (targetPlan: string, targetInterval = interval) => requestSellerSubscriptionChange({ db, storeId: "store", userId: "seller", planId: targetPlan, interval: targetInterval, now, providers });
  return { db, tx, providers, request, local: () => local, changes: () => changes, live: () => live, schedule: () => schedule, keys, counts: () => ({ upgrades, creates, configures, releases }), setMode: (value: string) => { mode = value; }, failPersist: () => { failPersist = true; } };
}

test("transition policy: same-interval upgrades are immediate; every interval change and downgrade is scheduled", () => {
  assert.equal(subscriptionChangeOperation("basic", "monthly", "pro", "monthly"), "UPGRADE");
  assert.equal(subscriptionChangeOperation("plus", "annual", "pro", "annual"), "UPGRADE");
  assert.equal(subscriptionChangeOperation("pro", "monthly", "basic", "monthly"), "SCHEDULE");
  assert.equal(subscriptionChangeOperation("basic", "monthly", "pro", "annual"), "SCHEDULE");
  assert.equal(subscriptionChangeOperation("pro", "annual", "pro", "monthly"), "SCHEDULE");
  assert.throws(() => subscriptionChangeOperation("pro", "monthly", "pro", "monthly"), /PLAN_ALREADY_CURRENT/);
});

for (const source of ["basic", "plus"]) test(`${source} to PRO waits for invoice success before entitlement changes`, () => withPrices(async () => {
  const f = fixture(source); const change = await f.request("pro");
  assert.equal(change.status, "AWAITING_PAYMENT"); assert.equal(change.stripeInvoiceId, "in_upgrade"); assert.equal(f.local().plan, source);
  f.live().pending_update = null; f.live().items!.data![0].price = { id: "price_promonthly" }; (f.live().latest_invoice as any).paid = true;
  await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, now);
  assert.equal(f.changes()[0].status, "APPLIED"); assert.equal(f.changes()[0].stripeInvoiceId, "in_upgrade");
}));

test("failed upgrade retains the valid source plan and durable invoice correlation", () => withPrices(async () => {
  const f = fixture(); await f.request("pro"); await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, now);
  assert.equal(f.changes()[0].status, "AWAITING_PAYMENT"); assert.equal(f.local().plan, "basic"); assert.equal(f.local().status, "ACTIVE");
  f.live().pending_update = null; await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, now);
  assert.equal(f.changes()[0].status, "EXPIRED"); assert.equal(f.local().plan, "basic");
}));

test("concurrent identical clicks share one live upgrade; conflicting target fails closed", () => withPrices(async () => {
  const f = fixture(); const results = await Promise.all([f.request("pro"), f.request("pro")]);
  assert.equal(results[0].id, results[1].id); assert.equal(f.counts().upgrades, 1); assert.equal(f.changes().length, 1);
  await assert.rejects(() => f.request("plus"), /CHANGE_IN_PROGRESS/);
}));

test("ambiguous transport retry uses the original durable attempt and deterministic stage key", () => withPrices(async () => {
  const f = fixture(); f.setMode("timeout-before"); await assert.rejects(() => f.request("pro"), StripeTransportError);
  assert.equal(f.changes()[0].status, "PREPARED"); f.setMode("pending"); await f.request("pro");
  assert.deepEqual(f.keys, [subscriptionChangeKey("change_1", "upgrade"), subscriptionChangeKey("change_1", "upgrade")]);
}));

for (const failure of ["timeout-after", "persistence"]) test(`${failure} recovers accepted Stripe update without issuing another write`, () => withPrices(async () => {
  const f = fixture(); if (failure === "persistence") f.failPersist(); else f.setMode(failure);
  await assert.rejects(() => f.request("pro")); assert.equal(f.changes()[0].status, "PREPARED");
  await f.request("pro"); assert.equal(f.counts().upgrades, 1); assert.equal(f.changes().length, 1); assert.equal(f.changes()[0].stripeInvoiceId, "in_upgrade");
}));

for (const [plan, interval] of [["basic", "monthly"], ["plus", "monthly"], ["pro", "annual"]]) test(`PRO monthly schedules ${plan} ${interval} without changing current entitlement`, () => withPrices(async () => {
  const f = fixture("pro"); const result = await f.request(plan, interval);
  assert.equal(result.status, "SCHEDULED"); assert.equal(result.stripeScheduleId, "sched"); assert.equal(f.local().plan, "pro"); assert.equal(f.local().billingInterval, "monthly");
  assert.equal(f.local().scheduledPlan, plan); assert.equal(f.local().scheduledBillingInterval, interval); assert.deepEqual(f.local().scheduledChangeAt, boundary);
  assert.equal(f.counts().creates, 1); assert.equal(f.counts().upgrades, 0);
}));

test("annual to monthly is scheduled", () => withPrices(async () => {
  const f = fixture("pro", "annual"); await f.request("pro", "monthly"); assert.equal(f.local().billingInterval, "annual"); assert.equal(f.local().scheduledBillingInterval, "monthly");
}));

test("replacing and canceling schedules retains history and never cancels the subscription", () => withPrices(async () => {
  const f = fixture("pro"); await f.request("basic"); await f.request("plus");
  assert.equal(f.counts().creates, 1); assert.deepEqual(f.changes().map(change => change.status), ["CANCELED", "SCHEDULED"]);
  await requestSellerSubscriptionChange({ db: f.db, storeId: "store", userId: "seller", cancelSchedule: true, providers: f.providers, now });
  assert.equal(f.counts().releases, 1); assert.equal(f.local().scheduledPlan, null); assert.equal(f.local().plan, "pro"); assert.equal(f.live().status, "active");
  await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, now); assert.equal(f.local().scheduledPlan, null);
}));

test("late schedule webhook after replacement reads current metadata rather than restoring old target", () => withPrices(async () => {
  const f = fixture("pro"); await f.request("basic"); await f.request("plus"); await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, now);
  assert.equal(f.local().scheduledPlan, "plus"); assert.equal(f.changes()[0].status, "CANCELED");
}));

test("scheduled boundary applies lower quota without deleting stored product data", () => withPrices(async () => {
  const f = fixture("pro"); await f.request("basic"); f.live().items!.data![0].price = { id: "price_basicmonthly" }; f.live().current_period_start = boundary.getTime() / 1000;
  await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, boundary);
  assert.equal(f.changes()[0].status, "APPLIED"); assert.equal(f.local().scheduledPlan, null);
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "basic", productCount: 30 }), { productLimit: 10, blocked: true });
}));

test("duplicate invoice delivery is processed once and late failure does not demote authoritative active entitlement", () => withPrices(async () => {
  const f = fixture(); f.setMode("paid"); await f.request("pro"); let syncs = 0;
  const sync = async (_tx: any, live: StripeSubscription) => { syncs++; f.local().plan = live.items!.data![0].price!.id === "price_promonthly" ? "pro" : "basic"; return { storeId: "store", status: "ACTIVE" }; };
  const event: StripeEvent = { id: "evt_paid", type: "invoice.paid", data: { object: { id: "in_upgrade", object: "invoice", subscription: "sub" } } };
  await processSellerSubscriptionTransitionEvent(f.db, event, sync, f.providers);
  assert.deepEqual(await processSellerSubscriptionTransitionEvent(f.db, event, sync, f.providers), { duplicate: true });
  await processSellerSubscriptionTransitionEvent(f.db, { ...event, id: "evt_late_failure", type: "invoice.payment_failed" }, sync, f.providers);
  assert.equal(f.local().plan, "pro"); assert.equal(f.local().status, "ACTIVE"); assert.equal(syncs, 2);
}));

test("forged plans, intervals, unrecognized Price and wrong customer fail before provider mutation", () => withPrices(async () => {
  const f = fixture(); await assert.rejects(() => f.request("forged"), /INVALID_PLAN/); await assert.rejects(() => f.request("pro", "weekly"), /INVALID_PLAN/);
  f.live().customer = "other"; await assert.rejects(() => f.request("pro"), /SUBSCRIPTION_OWNER_MISMATCH/); f.live().customer = "cus";
  f.live().items!.data![0].price = { id: "price_unknown" }; await assert.rejects(() => f.request("pro"), /SUBSCRIPTION_CHANGED_REFRESH_REQUIRED/);
  assert.equal(f.counts().upgrades, 0); assert.equal(f.changes().length, 0);
}));

test("canonical amounts and all-product quotas remain unchanged", () => {
  assert.deepEqual(sellerPlans().map(plan => [plan.monthlyAmountMinor, plan.annualAmountMinor, plan.productLimit]), [[699, 6710, 10], [1499, 14390, 50], [2699, 25910, null]]);
});

test("concurrent downgrade clicks share one schedule and repeat requests reuse durable scheduled result", () => withPrices(async () => {
  const f = fixture("pro"); const results = await Promise.all([f.request("basic"), f.request("basic")]);
  assert.equal(results[0].id, results[1].id); await f.request("basic"); assert.equal(f.changes().length, 1); assert.equal(f.counts().creates, 1); assert.equal(f.counts().configures, 1);
}));

test("ambiguous schedule configuration recovers one schedule with the same operation stage key", () => withPrices(async () => {
  const f = fixture("pro"); f.setMode("schedule-timeout"); await assert.rejects(() => f.request("basic"));
  assert.equal(f.changes()[0].status, "PREPARED"); f.setMode("pending"); await f.request("basic");
  assert.equal(f.counts().creates, 1); assert.equal(f.changes().length, 1); assert.equal(f.local().scheduledPlan, "basic");
  assert.deepEqual(f.keys.filter(key => key.endsWith(":configure-schedule")), [subscriptionChangeKey("change_1", "configure-schedule"), subscriptionChangeKey("change_1", "configure-schedule")]);
}));

test("ambiguous schedule release reconciles without releasing twice or canceling subscription", () => withPrices(async () => {
  const f = fixture("pro"); await f.request("basic"); f.setMode("release-timeout");
  const cancel = () => requestSellerSubscriptionChange({ db: f.db, storeId: "store", userId: "seller", cancelSchedule: true, providers: f.providers, now });
  await assert.rejects(cancel); assert.equal(f.changes()[1].status, "PREPARED");
  await cancel(); assert.equal(f.counts().releases, 1); assert.equal(f.local().plan, "pro"); assert.equal(f.local().scheduledPlan, null);
}));

test("definite rejected upgrade is terminal while ambiguous old attempt fails closed beyond key-retention window", () => withPrices(async () => {
  const f = fixture(); f.setMode("rejected"); assert.equal((await f.request("pro")).status, "FAILED"); assert.equal(f.local().plan, "basic");
  f.setMode("pending"); await f.request("pro"); assert.equal(f.changes().length, 2);
  const old = fixture(); old.setMode("timeout-before"); await assert.rejects(() => old.request("pro"));
  old.changes()[0].createdAt = new Date(now.getTime() - 24 * 60 * 60_000); old.setMode("pending"); await assert.rejects(() => old.request("pro"), /CHANGE_RECONCILIATION_REQUIRED/);
  assert.equal(old.counts().upgrades, 1); assert.equal(old.changes().length, 1);
}));

test("stale local row, provider cancellation and wrong subscription identity cannot create a replacement", () => withPrices(async () => {
  const f = fixture(); f.live().id = "other"; await assert.rejects(() => f.request("pro"), /SUBSCRIPTION_CHANGED_REFRESH_REQUIRED/);
  f.live().id = "sub"; f.live().status = "canceled"; await assert.rejects(() => f.request("pro"), /SUBSCRIPTION_CHANGED_REFRESH_REQUIRED/);
  f.live().status = "active"; f.local().currentPeriodEnd = new Date(now.getTime() - 1000); await assert.rejects(() => f.request("pro"), /PAID_SUBSCRIPTION_REQUIRED/);
  assert.equal(f.changes().length, 0); assert.equal(f.counts().upgrades, 0);
}));

test("unpaid target snapshot cannot grant higher entitlement", () => withPrices(async () => {
  const f = fixture(); await f.request("pro"); f.live().items!.data![0].price = { id: "price_promonthly" }; f.live().pending_update = null;
  let syncs = 0;
  await assert.rejects(() => processSellerSubscriptionTransitionEvent(f.db, { id: "evt_unpaid", type: "customer.subscription.updated", data: { object: f.live() } }, async () => { syncs++; return { storeId: "store", status: "ACTIVE" }; }, f.providers), /UPGRADE_PAYMENT_NOT_CONFIRMED/);
  assert.equal(syncs, 0); assert.equal(f.local().plan, "basic");
}));

test("failed upgrade invoice webhook preserves current paid-plan entitlement", () => withPrices(async () => {
  const f = fixture(); await f.request("pro"); let seen: StripeSubscription | null = null;
  await processSellerSubscriptionTransitionEvent(f.db, { id: "evt_failed", type: "invoice.payment_failed", data: { object: { id: "in_upgrade", object: "invoice", subscription: "sub" } } }, async (_tx, live) => { seen = live; return { storeId: "store", status: "ACTIVE" }; }, f.providers);
  assert.equal((seen as StripeSubscription | null)?.status, "active"); assert.equal(f.local().plan, "basic"); assert.equal(f.changes()[0].status, "AWAITING_PAYMENT");
}));

test("lower-plan team reactivation fails without deleting membership or changing sessions", async () => {
  let mutations = 0;
  const tx: any = { $queryRaw: async () => [{ id: "business", maxStores: 3 }], sellerTeamMembership: { findUnique: async () => ({ id: "member", businessId: "business", status: "SUSPENDED", business: { ownerId: "seller" } }), update: async () => { mutations++; } }, sellerBusiness: { findUnique: async () => ({ owner: { role: "SELLER" }, billingStore: { id: "store", subscription: { status: "ACTIVE", plan: "basic", currentPeriodEnd: boundary }, accessGrants: [] } }) } };
  await assert.rejects(() => updateSellerTeamMember({ $transaction: async (fn: any) => fn(tx) } as any, { ownerId: "seller", membershipId: "member", action: "reactivate" }, now), /TEAM_PRO_REQUIRED/);
  assert.equal(mutations, 0);
});

test("Stripe upgrade uses native pending-update proration; interval schedule disables proration", async () => {
  const previousFetch = globalThis.fetch, previousMode = process.env.STRIPE_MODE, previousKey = process.env.STRIPE_SECRET_KEY;
  const requests: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }> = [];
  process.env.STRIPE_MODE = "test"; process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  globalThis.fetch = (async (url: any, init: any) => { requests.push({ url: String(url), body: init.body, headers: init.headers }); return { ok: true, json: async () => ({ id: "mock" }) } as Response; }) as typeof fetch;
  try {
    await upgradeSellerStripeSubscription({ subscriptionId: "sub", itemId: "si", priceId: "price_promonthly", prorationAt: now, idempotencyKey: "change:upgrade" });
    assert.equal(requests[0].body.get("payment_behavior"), "pending_if_incomplete"); assert.equal(requests[0].body.get("proration_behavior"), "always_invoice"); assert.equal(requests[0].body.get("proration_date"), String(now.getTime() / 1000)); assert.equal(requests[0].headers["Idempotency-Key"], "change:upgrade");
    await configureSellerSubscriptionSchedule({ scheduleId: "sched", changeId: "change", start: now, boundary, sourcePriceId: "price_promonthly", targetPriceId: "price_proannual", interval: "annual", idempotencyKey: "change:configure", currentPhase: { start_date: now.getTime() / 1000, items: [{ price: "price_promonthly", quantity: 1, tax_rates: [{ id: "txr_test" }] }], discounts: [{ id: "di_test" }], metadata: { retained: "yes" }, collection_method: "charge_automatically" } });
    assert.equal(requests[1].body.get("end_behavior"), "release"); assert.equal(requests[1].body.get("proration_behavior"), "none"); assert.equal(requests[1].body.get("phases[1][start_date]"), String(boundary.getTime() / 1000)); assert.equal(requests[1].body.get("phases[1][duration][interval]"), "year");
    assert.equal(requests[1].body.get("phases[0][discounts][0][discount]"), "di_test"); assert.equal(requests[1].body.get("phases[1][discounts][0][discount]"), "di_test"); assert.equal(requests[1].body.get("phases[1][items][0][tax_rates][0]"), "txr_test"); assert.equal(requests[1].body.get("phases[0][metadata][retained]"), "yes");
    assert.ok(requests.every(request => !request.url.includes("checkout/sessions") && !request.body.has("unit_amount")));
  } finally { globalThis.fetch = previousFetch; if (previousMode === undefined) delete process.env.STRIPE_MODE; else process.env.STRIPE_MODE = previousMode; if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey; }
});

test("late schedule events after replacement and cancellation cannot restore superseded summaries", () => withPrices(async () => {
  const f = fixture("pro"); await f.request("basic"); await f.request("plus");
  const event: StripeEvent = { id: "evt_late_schedule", type: "subscription_schedule.updated", data: { object: { id: "sched", object: "subscription_schedule", status: "active", subscription: "sub", metadata: { todijoChangeId: "change_1" } } } };
  const sync = async () => ({ storeId: "store", status: "ACTIVE" });
  await processSellerSubscriptionTransitionEvent(f.db, event, sync, f.providers); assert.equal(f.local().scheduledPlan, "plus");
  await requestSellerSubscriptionChange({ db: f.db, storeId: "store", userId: "seller", cancelSchedule: true, providers: f.providers, now });
  await processSellerSubscriptionTransitionEvent(f.db, { ...event, id: "evt_after_cancel" }, sync, f.providers); assert.equal(f.local().scheduledPlan, null); assert.equal(f.local().plan, "pro");
}));

for (const afterBoundary of [false, true]) test(`schedule identity survives persistence failure and reconciles ${afterBoundary ? "after release" : "before the boundary"}`, () => withPrices(async () => {
  const f = fixture("pro"); f.failPersist(); await assert.rejects(() => f.request("basic"), /database unavailable/);
  assert.equal(f.changes()[0].status, "PREPARED"); assert.equal(f.changes()[0].stripeScheduleId, "sched");
  if (afterBoundary) { f.live().items!.data![0].price = { id: "price_basicmonthly" }; f.live().current_period_start = boundary.getTime() / 1000; f.live().schedule = null; f.schedule()!.status = "released"; }
  await reconcileSellerSubscriptionChanges(f.tx, f.live(), f.providers, afterBoundary ? boundary : now);
  assert.equal(f.changes()[0].status, afterBoundary ? "APPLIED" : "SCHEDULED"); assert.equal(f.counts().creates, 1);
  assert.equal(f.local().scheduledPlan, afterBoundary ? null : "basic");
}));
