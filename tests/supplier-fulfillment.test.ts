import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CjFulfillmentApiError, CjFulfillmentClient, classifyCjFulfillmentFailure, normalizeOrderDetail, normalizeTracking } from "../lib/suppliers/cj-fulfillment-client";
import { automaticCjFulfillmentEnabled, deterministicSupplierReference, prepareSupplierFulfillments, processSupplierFulfillment, recoverSupplierFulfillment } from "../lib/suppliers/supplier-fulfillment";

const auth = { getAccessToken: async () => "super-secret-token", invalidateAccessToken() {} };
const input = { fulfillmentId: "ful_1", externalReference: "tdj-order-group", originCountry: "CN", destinationCountry: "FR", shippingMethod: "CJPacket", recipient: { name: "Buyer", address1: "1 street", city: "Paris", postalCode: "75001" }, products: [{ supplierVariantId: "vid_1", quantity: 2 }] };

test("CJ createOrderV2 uses deterministic reference, exact variant/quantity and documented balance payment", async () => {
  let body: any; let path = "";
  const client = new CjFulfillmentClient(auth, { minimumRequestIntervalMs: 0, fetcher: async (url, init) => { path = String(url); body = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ result: true, code: 200, data: { orderId: "cj_1", orderNum: "tdj-order-group", orderStatus: "UNPAID" } }), { status: 200 }); } });
  const result = await client.createOrder(input);
  assert.match(path, /\/shopping\/order\/createOrderV2$/);
  assert.equal(body.orderNumber, input.externalReference); assert.equal(body.payType, 2);
  assert.deepEqual(body.products, [{ vid: "vid_1", quantity: 2 }]);
  assert.equal(result.supplierOrderId, "cj_1"); assert.equal(result.status, "UNPAID");
  assert.equal("supplierUnitCost" in body, false);
});

test("network ambiguity is explicit and is not classified as blindly retryable", async () => {
  const client = new CjFulfillmentClient(auth, { minimumRequestIntervalMs: 0, fetcher: async () => { throw new Error("timeout"); } });
  await assert.rejects(() => client.createOrder(input), (error: unknown) => error instanceof CjFulfillmentApiError && error.ambiguous && !error.retryable);
});

test("CJ diagnostics redact access tokens and do not log private payloads", async () => {
  const lines: string[] = []; const original = console.info; console.info = (...args: unknown[]) => lines.push(args.join(" "));
  try {
    const client = new CjFulfillmentClient(auth, { minimumRequestIntervalMs: 0, fetcher: async () => new Response(JSON.stringify({ result: false, code: 500, message: "bad super-secret-token" }), { status: 400 }) });
    await assert.rejects(() => client.createOrder(input));
  } finally { console.info = original; }
  const log = lines.join("\n"); assert.doesNotMatch(log, /super-secret-token|supplierUnitCost|Authorization|CJ-Access-Token/); assert.match(log, /\[REDACTED\]/);
});

test("CJ insufficient wallet failures use a stable recoverable-manual code", () => {
  assert.deepEqual(classifyCjFulfillmentFailure({ operation: "create-order-v2", httpStatus: 200, responseCode: 1601001, responseMessage: "Insufficient wallet balance" }), { code: "CJ_WALLET_INSUFFICIENT", retryable: false });
  assert.deepEqual(classifyCjFulfillmentFailure({ operation: "get-order-detail", httpStatus: 200, responseCode: 1602001, responseMessage: "Order not found" }), { code: "CJ_ORDER_NOT_FOUND", retryable: false });
});

test("order detail and split tracking normalization are conservative and deduplicated", () => {
  const detail = normalizeOrderDetail({ orderId: "cj_1", orderNum: "tdj_1", orderStatus: "SHIPPED", trackNumber: "track_1", trackingProvider: "Carrier" });
  assert.equal(detail.status, "SHIPPED");
  const tracking = normalizeTracking([{ shipmentOrderId: "s1", trackNumber: "track_1", trackingProvider: "Carrier" }, { shipmentOrderId: "s2", trackNumber: "track_2", trackingProvider: "Other" }], detail.tracking);
  assert.deepEqual(tracking.map((item) => item.trackingNumber), ["track_1", "track_2"]);
  assert.equal(normalizeOrderDetail({ orderStatus: "SOMETHING_NEW" }).status, "SOMETHING_NEW");
});

test("deterministic supplier reference is stable, bounded, and grouping-sensitive", () => {
  const first = deterministicSupplierReference("order_123456789012345678901234", "platform-cj|CN|FR|CJPacket");
  assert.equal(first, deterministicSupplierReference("order_123456789012345678901234", "platform-cj|CN|FR|CJPacket"));
  assert.notEqual(first, deterministicSupplierReference("order_123456789012345678901234", "platform-cj|US|FR|CJPacket"));
  assert.ok(first.length <= 50);
});

test("only an exact authoritative supplier snapshot creates fulfillment work", async () => {
  const calls: any[] = [];
  const db = { supplierFulfillment: { upsert: async (args: any) => { calls.push(args); return args.create; } } } as any;
  const base = { id: "order_1", shippingCountry: "FR", items: [{ id: "item_1", productId: "p1", variantId: "v1", quantity: 2, supplierPricingSnapshot: { snapshot: { provider: "CJ", productId: "p1", variantId: "v1", supplierProductId: "cj-p1", supplierVariantId: "cj-v1", originCountry: "CN", quantity: 2, shippingMethod: "CJPacket" } }, product: { supplierLink: { provider: "CJ", ownerType: "PLATFORM", connectionId: "platform-cj", supplierProductId: "cj-p1", connection: { id: "platform-cj", status: "CONNECTED" } } } }] };
  assert.equal(await prepareSupplierFulfillments(db, base as any), 1); assert.equal(calls.length, 1);
  assert.equal(calls[0].create.items.create[0].supplierVariantId, "cj-v1"); assert.equal(calls[0].create.items.create[0].quantity, 2);
  calls.length = 0; const stale = structuredClone(base); stale.items[0].supplierPricingSnapshot.snapshot.supplierProductId = "wrong";
  assert.equal(await prepareSupplierFulfillments(db, stale as any), 1); assert.equal(calls.length, 1);
  assert.equal(calls[0].create.status, "MANUAL_ACTION_REQUIRED"); assert.equal(calls[0].create.lastErrorCode, "SUPPLIER_FULFILLMENT_MAPPING_INVALID");
});

test("seller-owned supplier work fails closed without platform credential fallback", async () => {
  const calls: any[] = []; const db = { supplierFulfillment: { upsert: async (args: any) => calls.push(args) } } as any;
  const order: any = { id: "order_2", shippingCountry: "FR", items: [{ id: "item_2", productId: "p2", variantId: "v2", quantity: 1, supplierPricingSnapshot: { snapshot: { provider: "CJ", productId: "p2", variantId: "v2", supplierProductId: "cj-p2", supplierVariantId: "cj-v2", originCountry: "CN", quantity: 1, shippingMethod: "CJPacket" } }, product: { supplierLink: { provider: "CJ", ownerType: "SELLER", connectionId: "seller-cj", supplierProductId: "cj-p2", connection: { id: "seller-cj", status: "CONNECTED" } } } }] };
  await prepareSupplierFulfillments(db, order); assert.equal(calls[0].create.status, "MANUAL_ACTION_REQUIRED"); assert.equal(calls[0].create.lastErrorCode, "SELLER_SUPPLIER_AUTH_NOT_CONNECTED");
});

test("normal marketplace lines never create CJ fulfillment work", async () => {
  let called = false; const db = { supplierFulfillment: { upsert: async () => { called = true; } } } as any;
  assert.equal(await prepareSupplierFulfillments(db, { id: "order_3", shippingCountry: "FR", items: [{ id: "normal", productId: "p", variantId: null, quantity: 1 }] } as any), 0);
  assert.equal(called, false);
});

test("fulfillment migration is additive and does not rewrite historical commerce data", () => {
  const sql = readFileSync(join(process.cwd(), "prisma", "migrations", "20260812100000_add_supplier_fulfillment", "migration.sql"), "utf8");
  assert.match(sql, /CREATE TABLE "SupplierFulfillment"/); assert.match(sql, /CREATE TABLE "SupplierTracking"/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM|UPDATE\s+"(?:Order|OrderItem|Product)")\b/i);
});

test("Stripe webhook dispatches supplier work only after paid finalization and isolates supplier failure", () => {
  const source = readFileSync(join(process.cwd(), "app", "api", "stripe", "webhook", "route.ts"), "utf8");
  assert.match(source, /await processStripeEvent[\s\S]+result\.paid === true[\s\S]+automaticCjFulfillmentEnabled\(\)[\s\S]+processOrderSupplierFulfillments/);
  assert.match(source, /catch \(error\)[\s\S]+paid_order_fulfillment_dispatch_failed/);
});

test("automatic CJ fulfillment is disabled unless explicitly enabled", () => {
  assert.equal(automaticCjFulfillmentEnabled(undefined), false);
  assert.equal(automaticCjFulfillmentEnabled("false"), false);
  assert.equal(automaticCjFulfillmentEnabled("TRUE"), true);
});

test("buyer order payload exposes normalized progress but no supplier-private commerce or retry fields", () => {
  const source = readFileSync(join(process.cwd(), "lib", "buyer-orders.ts"), "utf8");
  assert.match(source, /supplierFulfillments:[\s\S]+status: true[\s\S]+tracking:/);
  assert.doesNotMatch(source, /supplierUnitCost|freightTotal|includedCost|targetMargin|lastErrorCode|attemptCount|supplierOrderId|connectionId/);
});

test("supplier retry and sync routes require database-verified admin authorization", () => {
  for (const action of ["retry", "sync"]) {
    const source = readFileSync(join(process.cwd(), "app", "api", "admin", "supplier-fulfillments", "[fulfillmentId]", action, "route.ts"), "utf8");
    assert.match(source, /requireAdmin\(prisma, await readSession\(\)\)/); assert.doesNotMatch(source, /SELLER|CUSTOMER/);
  }
});

test("concurrent fulfillment claims permit exactly one supplier submission", async () => {
  let claimed = false; let submissions = 0;
  const fulfillment = { id: "ful_race", externalReference: "tdj-race", connectionId: "platform-cj", originCountry: "CN", destinationCountry: "FR", shippingMethod: "CJPacket", submittedAt: null, order: { paidAt: new Date(), status: "PAID", recipientName: "Buyer", shippingAddressLine1: "1 street", shippingAddressLine2: null, shippingCity: "Paris", shippingState: null, shippingPostalCode: "75001", recipientPhone: null }, connection: { ownerType: "PLATFORM", status: "CONNECTED" }, items: [{ supplierVariantId: "vid_1", quantity: 1 }], tracking: [] };
  const tx = { supplierFulfillment: { update: async () => ({}) }, supplierTracking: { upsert: async () => ({}) } };
  const db = { supplierFulfillment: {
    updateMany: async (args: any) => { if (args.data.status === "SUBMITTING") { if (claimed) return { count: 0 }; claimed = true; return { count: 1 }; } return { count: 1 }; },
    findUniqueOrThrow: async () => fulfillment,
  }, $transaction: async (callback: any) => callback(tx) } as any;
  const client = { createOrder: async () => { submissions += 1; return { supplierOrderId: "cj_1", supplierOrderNumber: "tdj-race", status: "PROCESSING", tracking: [] }; } } as any;
  const results = await Promise.all([processSupplierFulfillment(db, "ful_race", client), processSupplierFulfillment(db, "ful_race", client)]);
  assert.equal(submissions, 1); assert.equal(results.filter((result) => result.claimed).length, 1);
});

function recoverableFulfillment(status = "MANUAL_ACTION_REQUIRED", lastErrorCode = "CJ_WALLET_INSUFFICIENT") {
  return { id: "ful_recover", status, lastErrorCode, externalReference: "tdj-stable-reference", connectionId: "platform-cj", originCountry: "CN", destinationCountry: "FR", shippingMethod: "CJPacket", submittedAt: null, order: { paidAt: new Date(), status: "PAID", recipientName: "Buyer", shippingAddressLine1: "1 street", shippingAddressLine2: null, shippingCity: "Paris", shippingState: null, shippingPostalCode: "75001", recipientPhone: null }, connection: { ownerType: "PLATFORM", status: "CONNECTED" }, items: [{ supplierVariantId: "vid_1", quantity: 1 }], tracking: [] };
}

test("approved wallet recovery reconciles first, then submits once with the same reference when absent", async () => {
  const fulfillment = recoverableFulfillment(); const transitions: any[] = []; const calls: string[] = [];
  const tx = { supplierFulfillment: { update: async () => ({}) }, supplierTracking: { upsert: async () => ({}) } };
  const db = { supplierFulfillment: {
    findUnique: async () => ({ status: fulfillment.status, lastErrorCode: fulfillment.lastErrorCode }),
    findUniqueOrThrow: async () => fulfillment,
    updateMany: async (args: any) => { transitions.push(args); return { count: 1 }; },
  }, $transaction: async (callback: any) => callback(tx) } as any;
  const client = {
    getOrderDetail: async (_id: string, reference: string) => { calls.push(`reconcile:${reference}`); throw new CjFulfillmentApiError("CJ_ORDER_NOT_FOUND", false, false); },
    createOrder: async (request: any) => { calls.push(`create:${request.externalReference}`); return { supplierOrderId: "cj_1", supplierOrderNumber: request.externalReference, status: "PROCESSING", tracking: [] }; },
  } as any;
  const result = await recoverSupplierFulfillment(db, fulfillment.id, client);
  assert.deepEqual(calls, ["reconcile:tdj-stable-reference", "create:tdj-stable-reference"]);
  assert.equal(result.submitted, true); assert.equal(transitions[0].data.status, "RETRYABLE"); assert.equal(transitions[1].data.status, "SUBMITTING");
});

test("recovery never recreates an ambiguous supplier order that cannot be reconciled", async () => {
  const fulfillment = recoverableFulfillment("AMBIGUOUS", "CJ_FULFILLMENT_AMBIGUOUS"); let creates = 0;
  const db = { supplierFulfillment: { findUnique: async () => ({ status: fulfillment.status, lastErrorCode: fulfillment.lastErrorCode }), findUniqueOrThrow: async () => fulfillment } } as any;
  const client = { getOrderDetail: async () => { throw new CjFulfillmentApiError("CJ_ORDER_NOT_FOUND", false, false); }, createOrder: async () => { creates += 1; } } as any;
  const result = await recoverSupplierFulfillment(db, fulfillment.id, client);
  assert.equal(result.status, "AMBIGUOUS"); assert.equal(creates, 0);
});

test("recovery accepts an existing reconciled order without creating another", async () => {
  const fulfillment = recoverableFulfillment(); let creates = 0; let persisted: any;
  const tx = { supplierFulfillment: { update: async (args: any) => { persisted = args; } }, supplierTracking: { upsert: async () => ({}) } };
  const db = { supplierFulfillment: { findUnique: async () => ({ status: fulfillment.status, lastErrorCode: fulfillment.lastErrorCode }), findUniqueOrThrow: async () => fulfillment }, $transaction: async (callback: any) => callback(tx) } as any;
  const client = { getOrderDetail: async () => ({ supplierOrderId: "cj_existing", supplierOrderNumber: fulfillment.externalReference, status: "PROCESSING", tracking: [] }), createOrder: async () => { creates += 1; } } as any;
  const result = await recoverSupplierFulfillment(db, fulfillment.id, client);
  assert.equal("reconciled" in result && result.reconciled, true); assert.equal(creates, 0); assert.equal(persisted.data.supplierOrderId, "cj_existing");
});

test("unrelated manual supplier failures remain blocked", async () => {
  const db = { supplierFulfillment: { findUnique: async () => ({ status: "MANUAL_ACTION_REQUIRED", lastErrorCode: "SUPPLIER_CONNECTION_NOT_AUTHORIZED" }) } } as any;
  await assert.rejects(() => recoverSupplierFulfillment(db, "ful_blocked", {} as any), /FULFILLMENT_NOT_RETRYABLE/);
});
