import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales } from "../i18n/config";
import { orderShipmentCopy } from "../i18n/order-shipment";
import { canonicalOrderShipments } from "../lib/tracking";
import { remainingShipmentQuantity } from "../lib/seller-shipments";
import { enqueueBuyerPaymentConfirmation, enqueueBuyerShipmentEmail, processBuyerOrderEmailDelivery } from "../lib/buyer-order-email-deliveries";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("seller shipment availability subtracts already-shipped and refund-held quantities without becoming negative", () => {
  assert.equal(remainingShipmentQuantity(5, 2, 1), 2);
  assert.equal(remainingShipmentQuantity(3, 2, 4), 0);
  assert.equal(remainingShipmentQuantity(2, 0, 0), 2);
});

test("buyer tracking retains distinct shipment records and only their shipped item quantities", () => {
  const shipments = canonicalOrderShipments({
    status: "PROCESSING", shippedAt: null, deliveredAt: null, trackingCarrier: null, trackingNumber: null, supplierFulfillments: [],
    shipments: [
      { id: "shipment-a", status: "SELLER_REPORTED", carrier: "UPS", trackingNumber: "A-1", trackingUrl: "https://www.ups.com/track?tracknum=A-1", sellerReportedAt: new Date("2026-10-01T10:00:00Z"), carrierAcceptedAt: null, deliveredAt: null, store: { name: "Store A" }, items: [{ quantity: 2, orderItem: { productNameSnapshot: "Item A", product: { name: "Item A" } } }] },
      { id: "shipment-b", status: "SELLER_REPORTED", carrier: null, trackingNumber: null, trackingUrl: null, sellerReportedAt: new Date("2026-10-02T10:00:00Z"), carrierAcceptedAt: null, deliveredAt: null, store: { name: "Store B" }, items: [{ quantity: 1, orderItem: { productNameSnapshot: "Item B", product: { name: "Item B" } } }] },
    ],
  });
  assert.deepEqual(shipments.map(({ id }) => id), ["shipment-a", "shipment-b"]);
  assert.deepEqual(shipments.map(({ items }) => items), [[{ name: "Item A", quantity: 2 }], [{ name: "Item B", quantity: 1 }]]);
  assert.equal(shipments[0].status, "shipped");
  assert.equal(shipments[1].trackingNumber, null);
});

test("Phase 6 approved shipment copy is present in every supported locale with exact French and English labels", () => {
  assert.deepEqual(Object.keys(orderShipmentCopy("en")).sort(), Object.keys(orderShipmentCopy("fr")).sort());
  assert.equal(orderShipmentCopy("fr").ordered, "Quantité commandée");
  assert.equal(orderShipmentCopy("en").ordered, "Ordered quantity");
  assert.equal(orderShipmentCopy("fr").previouslyShipped, "Déjà expédiée");
  assert.equal(orderShipmentCopy("en").previouslyShipped, "Previously shipped");
  assert.equal(orderShipmentCopy("fr").selectAllRemaining, "Sélectionner toutes les quantités restantes");
  assert.equal(orderShipmentCopy("en").selectAllRemaining, "Select all remaining quantities");
  assert.equal(orderShipmentCopy("fr").saveShipment, "Enregistrer l’expédition");
  assert.equal(orderShipmentCopy("en").saveShipment, "Save shipment");
  assert.equal(orderShipmentCopy("fr").partialStatus, "Partiellement expédiée");
  assert.equal(orderShipmentCopy("en").partialStatus, "Partially shipped");
  assert.equal(orderShipmentCopy("fr").paymentSubject, "Votre commande Todijo est confirmée");
  assert.equal(orderShipmentCopy("en").paymentSubject, "Your Todijo order is confirmed");
  assert.equal(orderShipmentCopy("fr").partialSubject, "Une partie de votre commande Todijo a été expédiée");
  assert.equal(orderShipmentCopy("en").partialSubject, "Part of your Todijo order has shipped");
  assert.match(orderShipmentCopy("fr").partialBody, /\{store\}[\s\S]*\{order\}[\s\S]*\{items\}/);
  assert.match(orderShipmentCopy("en").partialBody, /\{store\}[\s\S]*\{order\}[\s\S]*\{items\}/);
  for (const locale of locales) for (const value of Object.values(orderShipmentCopy(locale))) assert.ok(value.trim(), `${locale} contains an empty copy value`);
});

test("seller shipment endpoint is store-authorized, origin-checked, transactional, auditable, and does not decrement stock", () => {
  const route = read("app", "api", "seller", "orders", "[orderId]", "shipments", "route.ts");
  const service = read("lib", "seller-shipments.ts");
  const schema = read("prisma", "schema.prisma");
  assert.match(route, /isTrustedMutationRequest/);
  assert.match(route, /readSession/);
  assert.match(service, /requireStoreCapability\(tx, actorId, storeId, "ORDER_FULFILL"\)/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /Serializable/);
  assert.match(service, /appendSellerBusinessAudit/);
  assert.match(service, /enqueueBuyerShipmentEmail/);
  assert.doesNotMatch(service, /product\.updateMany|productVariant\.updateMany|stock:\s*\{\s*decrement/);
  assert.match(schema, /model ShipmentItem[\s\S]*quantity\s+Int/);
});

test("legacy whole-order seller route cannot mark an order shipped or delivered", () => {
  const route = read("app", "api", "seller", "orders", "[orderId]", "fulfillment", "route.ts");
  assert.match(route, /isTrustedMutationRequest/);
  assert.match(route, /body\.action === "PROCESSING" \|\| body\.action === "SHIPPED"/);
  assert.match(route, /ITEM_LEVEL_SHIPMENT_REQUIRED/);
});

test("buyer email uses a durable per-payment/per-shipment key, snapshots items, and retries without exposing raw errors", () => {
  const outbox = read("lib", "buyer-order-email-deliveries.ts");
  const payment = read("lib", "payments.ts");
  const worker = read("app", "api", "internal", "seller-sale-notifications", "route.ts");
  assert.match(outbox, /order-payment-confirmed:/);
  assert.match(outbox, /order-shipment-recorded:/);
  assert.match(outbox, /safeEmailError/);
  assert.match(outbox, /"RETRYABLE" as const/);
  assert.match(payment, /enqueueBuyerPaymentConfirmation\(tx, order\.id\)/);
  assert.match(worker, /processDueBuyerOrderEmailDeliveries/);
});

test("buyer shipment email retries a temporary transport failure with bounded safe error state", async () => {
  const row: any = { id: "delivery-1", status: "QUEUED", attemptCount: 0, claimToken: null, claimedAt: null, nextAttemptAt: null, errorCode: null, errorMessage: null, sentAt: null };
  const db: any = { buyerOrderEmailDelivery: {
    updateMany: async ({ where, data }: any) => {
      if (where.id !== row.id || (where.status?.in && !where.status.in.includes(row.status)) || (where.claimToken && where.claimToken !== row.claimToken)) return { count: 0 };
      for (const [key, value] of Object.entries(data)) row[key] = typeof value === "object" && value && "increment" in value ? row[key] + (value as any).increment : value;
      return { count: 1 };
    },
    findUniqueOrThrow: async () => ({ id: row.id, orderId: "order-private", kind: "SHIPMENT_RECORDED", locale: "fr", recipientEmail: "buyer@example.test", recipientName: "Buyer", orderReference: "order-private", storeName: "Store A", items: [{ name: "Article A", quantity: 2 }], attemptCount: row.attemptCount }),
  } };
  const result = await processBuyerOrderEmailDelivery(db, row.id, async () => { const error: any = new Error("private SMTP diagnostic"); error.code = "ETIMEDOUT"; throw error; }, new Date("2026-10-09T12:00:00Z"));
  assert.deepEqual(result, { outcome: "RETRYABLE" });
  assert.equal(row.status, "RETRYABLE");
  assert.equal(row.errorCode, "ETIMEDOUT");
  assert.equal(row.errorMessage, "Error");
  assert.ok(row.nextAttemptAt instanceof Date);
});

test("payment and shipment email outbox records use authoritative buyer snapshots and exact per-shipment items", async () => {
  const deliveries: any[] = [];
  const tx: any = {
    order: { findUnique: async () => ({ id: "order-1", buyerId: "buyer-1", buyerLocale: "fr", buyerEmailSnapshot: "buyer@example.test", buyerNameSnapshot: "Buyer", buyer: { email: "fallback@example.test", firstName: "Fallback" } }) },
    buyerOrderEmailDelivery: { create: async ({ data }: any) => { deliveries.push(data); return data; } },
  };
  await enqueueBuyerPaymentConfirmation(tx, "order-1");
  await enqueueBuyerShipmentEmail(tx, { orderId: "order-1", shipmentId: "shipment-1", storeName: "Store A", kind: "SHIPMENT_RECORDED", items: [{ name: "Actual item", quantity: 2 }] });
  assert.equal(deliveries[0].eventKey, "order-payment-confirmed:order-1");
  assert.equal(deliveries[0].locale, "fr");
  assert.equal(deliveries[0].recipientEmail, "buyer@example.test");
  assert.equal(deliveries[1].eventKey, "order-shipment-recorded:shipment-1");
  assert.deepEqual(deliveries[1].items, [{ name: "Actual item", quantity: 2 }]);
  assert.equal(JSON.stringify(deliveries[1].items).includes("other seller"), false);
});
