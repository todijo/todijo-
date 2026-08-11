import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { PLATFORM_CJ_CONNECTION_ID } from "./supplier-access";
import { CjFulfillmentApiError, CjFulfillmentClient, type CjOrderDetail } from "./cj-fulfillment-client";

type Database = PrismaClient | Prisma.TransactionClient;
type Snapshot = { provider?: unknown; productId?: unknown; variantId?: unknown; supplierProductId?: unknown; supplierVariantId?: unknown; originCountry?: unknown; quantity?: unknown; shippingMethod?: unknown };
type PaidOrder = {
  id: string; shippingCountry: string | null;
  items: Array<{ id: string; productId: string; variantId: string | null; quantity: number; supplierPricingSnapshot?: { snapshot: Prisma.JsonValue } | null; product?: { supplierLink?: { provider: "CJ"; ownerType: "PLATFORM" | "SELLER"; connectionId: string | null; supplierProductId: string; connection?: { id: string; status: string; store?: { dropshippingEnabled: boolean } | null } | null } | null } }>;
};

function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function country(value: unknown) { const result = string(value).toUpperCase(); return /^[A-Z]{2}$/.test(result) ? result : ""; }
function snapshot(value: Prisma.JsonValue): Snapshot { return value && typeof value === "object" && !Array.isArray(value) ? value as Snapshot : {}; }
export function deterministicSupplierReference(orderId: string, groupKey: string) { return `tdj-${orderId.slice(0, 18)}-${createHash("sha256").update(groupKey).digest("hex").slice(0, 16)}`.slice(0, 50); }
export function automaticCjFulfillmentEnabled(value = process.env.CJ_AUTOMATIC_FULFILLMENT_ENABLED) { return value?.trim().toLowerCase() === "true"; }
export function isApprovedManualSupplierRetry(code: string | null | undefined) { return code === "CJ_WALLET_INSUFFICIENT"; }

export async function prepareSupplierFulfillments(tx: Database, order: PaidOrder) {
  const groups = new Map<string, { connectionId: string | null; originCountry: string | null; destinationCountry: string | null; shippingMethod: string | null; manual: boolean; errorCode: string | null; items: Array<{ orderItemId: string; supplierProductId: string; supplierVariantId: string; quantity: number }> }>();
  for (const item of order.items) {
    if (!item.supplierPricingSnapshot) continue;
    const snap = snapshot(item.supplierPricingSnapshot.snapshot);
    if (snap.provider !== "CJ" || !string(snap.supplierProductId) || !string(snap.supplierVariantId)) continue;
    const link = item.product?.supplierLink;
    const connectionId = link?.connectionId ?? null;
    const originCountry = country(snap.originCountry) || null; const destinationCountry = country(order.shippingCountry) || null; const shippingMethod = string(snap.shippingMethod) || null;
    const exact = snap.productId === item.productId && snap.variantId === item.variantId && snap.supplierProductId === link?.supplierProductId && Number(snap.quantity) === item.quantity;
    const sellerUnsupported = link?.ownerType === "SELLER";
    const manual = !exact || !connectionId || !originCountry || !destinationCountry || !shippingMethod || sellerUnsupported || connectionId !== PLATFORM_CJ_CONNECTION_ID || link?.connection?.status !== "CONNECTED";
    const errorCode = !exact || !connectionId || !originCountry || !destinationCountry || !shippingMethod ? "SUPPLIER_FULFILLMENT_MAPPING_INVALID" : sellerUnsupported ? "SELLER_SUPPLIER_AUTH_NOT_CONNECTED" : manual ? "SUPPLIER_CONNECTION_NOT_AUTHORIZED" : null;
    const groupKey = manual && (!connectionId || !originCountry || !shippingMethod) ? `manual|${item.id}` : [connectionId, originCountry, destinationCountry, shippingMethod].join("|");
    const group = groups.get(groupKey) ?? { connectionId, originCountry, destinationCountry, shippingMethod, manual, errorCode, items: [] };
    group.manual ||= manual;
    group.errorCode ??= errorCode;
    group.items.push({ orderItemId: item.id, supplierProductId: string(snap.supplierProductId), supplierVariantId: string(snap.supplierVariantId), quantity: item.quantity });
    groups.set(groupKey, group);
  }
  for (const [groupKey, group] of groups) {
    const externalReference = deterministicSupplierReference(order.id, groupKey);
    await tx.supplierFulfillment.upsert({
      where: { externalReference }, update: {},
      create: {
        orderId: order.id, connectionId: group.connectionId, provider: "CJ", externalReference,
        status: group.manual ? "MANUAL_ACTION_REQUIRED" : "PENDING",
        originCountry: group.originCountry, destinationCountry: group.destinationCountry, shippingMethod: group.shippingMethod,
        lastErrorCategory: group.manual ? "PERMANENT" : null,
        lastErrorCode: group.errorCode,
        lastErrorMessage: group.manual ? "Supplier fulfillment requires an administrator review." : null,
        items: { create: group.items },
      },
    });
  }
  return groups.size;
}

function address(order: Awaited<ReturnType<typeof loadFulfillment>>["order"]) {
  const result = {
    name: string(order.recipientName), address1: string(order.shippingAddressLine1), address2: string(order.shippingAddressLine2) || undefined,
    city: string(order.shippingCity), state: string(order.shippingState) || undefined, postalCode: string(order.shippingPostalCode), phone: string(order.recipientPhone) || undefined,
  };
  if (!result.name || !result.address1 || !result.city || !result.postalCode) throw new Error("FULFILLMENT_ADDRESS_INCOMPLETE");
  return result;
}

async function loadFulfillment(db: PrismaClient, fulfillmentId: string) {
  return db.supplierFulfillment.findUniqueOrThrow({ where: { id: fulfillmentId }, include: { order: true, connection: true, items: true, tracking: true } });
}

function mappedStatus(status: string) {
  const value = status.toUpperCase();
  if (value === "DELIVERED") return "DELIVERED" as const;
  if (value === "SHIPPED") return "SHIPPED" as const;
  if (["PROCESSING", "UNSHIPPED", "PENDING"].includes(value)) return "PROCESSING" as const;
  if (["CANCELLED", "CANCELED"].includes(value)) return "CANCELLED" as const;
  return "SUBMITTED" as const;
}

async function persistSupplierDetail(db: PrismaClient, fulfillmentId: string, detail: CjOrderDetail, submitted = false) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.supplierFulfillment.update({ where: { id: fulfillmentId }, data: {
      status: mappedStatus(detail.status), supplierOrderId: detail.supplierOrderId, supplierOrderNumber: detail.supplierOrderNumber,
      supplierStatus: detail.status, lastSyncedAt: now, ...(submitted ? { submittedAt: now, confirmedAt: now } : {}),
      claimToken: null, claimedAt: null, lastErrorCategory: null, lastErrorCode: null, lastErrorMessage: null,
    } });
    for (const tracking of detail.tracking) await tx.supplierTracking.upsert({ where: { fulfillmentId_trackingNumber: { fulfillmentId, trackingNumber: tracking.trackingNumber } }, update: { carrier: tracking.carrier, supplierShipmentId: tracking.supplierShipmentId }, create: { fulfillmentId, ...tracking } });
  });
}

export async function processSupplierFulfillment(db: PrismaClient, fulfillmentId: string, client = new CjFulfillmentClient()) {
  const claimToken = randomUUID(); const now = new Date();
  const claimed = await db.supplierFulfillment.updateMany({ where: { id: fulfillmentId, status: { in: ["PENDING", "RETRYABLE"] } }, data: { status: "SUBMITTING", claimToken, claimedAt: now, attemptCount: { increment: 1 }, lastErrorCategory: null, lastErrorCode: null, lastErrorMessage: null } });
  if (claimed.count !== 1) return { claimed: false };
  const fulfillment = await loadFulfillment(db, fulfillmentId);
  try {
    if (!fulfillment.order.paidAt || fulfillment.order.status === "PENDING" || fulfillment.order.status === "CANCELLED") throw new Error("ORDER_PAYMENT_NOT_CONFIRMED");
    if (!fulfillment.connection || !fulfillment.originCountry || !fulfillment.destinationCountry || !fulfillment.shippingMethod) throw new Error("SUPPLIER_FULFILLMENT_MAPPING_INVALID");
    if (fulfillment.connection.ownerType !== "PLATFORM" || fulfillment.connectionId !== PLATFORM_CJ_CONNECTION_ID || fulfillment.connection.status !== "CONNECTED") throw new Error("SUPPLIER_CONNECTION_NOT_AUTHORIZED");
    const detail = await client.createOrder({ fulfillmentId, externalReference: fulfillment.externalReference, originCountry: fulfillment.originCountry, destinationCountry: fulfillment.destinationCountry, shippingMethod: fulfillment.shippingMethod, recipient: address(fulfillment.order), products: fulfillment.items.map((item) => ({ supplierVariantId: item.supplierVariantId, quantity: item.quantity })) });
    if (!detail.supplierOrderId) throw new CjFulfillmentApiError("CJ_CREATE_RESPONSE_UNCONFIRMED", true, false);
    await persistSupplierDetail(db, fulfillmentId, detail, true);
    return { claimed: true, submitted: true };
  } catch (error) {
    const api = error instanceof CjFulfillmentApiError ? error : null;
    const status = api?.ambiguous ? "AMBIGUOUS" : api?.retryable ? "RETRYABLE" : "MANUAL_ACTION_REQUIRED";
    const code = api?.code ?? (error instanceof Error ? error.message : "FULFILLMENT_FAILED");
    await db.supplierFulfillment.updateMany({ where: { id: fulfillmentId, claimToken }, data: { status, claimToken: null, claimedAt: null, lastErrorCategory: api?.ambiguous ? "AMBIGUOUS" : api?.retryable ? "RETRYABLE" : "PERMANENT", lastErrorCode: code.slice(0, 120), lastErrorMessage: (api?.safeMessage ?? code).slice(0, 500) } });
    return { claimed: true, submitted: false, status, code };
  }
}

export async function processOrderSupplierFulfillments(orderId: string) {
  const work = await prisma.supplierFulfillment.findMany({ where: { orderId, status: { in: ["PENDING", "RETRYABLE"] } }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const results = [];
  for (const item of work) results.push(await processSupplierFulfillment(prisma, item.id));
  return results;
}

export async function syncSupplierFulfillment(db: PrismaClient, fulfillmentId: string, client = new CjFulfillmentClient()) {
  const fulfillment = await loadFulfillment(db, fulfillmentId);
  if (!fulfillment.connection || fulfillment.connection.ownerType !== "PLATFORM" || fulfillment.connectionId !== PLATFORM_CJ_CONNECTION_ID) throw new Error("SUPPLIER_CONNECTION_NOT_AUTHORIZED");
  const detail = await client.getOrderDetail(fulfillment.id, fulfillment.externalReference);
  await persistSupplierDetail(db, fulfillment.id, detail, fulfillment.submittedAt === null);
  return detail;
}

export async function recoverSupplierFulfillment(db: PrismaClient, fulfillmentId: string, client = new CjFulfillmentClient()) {
  const fulfillment = await db.supplierFulfillment.findUnique({ where: { id: fulfillmentId }, select: { status: true, lastErrorCode: true } });
  if (!fulfillment) throw new Error("FULFILLMENT_NOT_FOUND");
  if (fulfillment.status === "PENDING" || fulfillment.status === "RETRYABLE") return processSupplierFulfillment(db, fulfillmentId, client);
  if (fulfillment.status === "AMBIGUOUS" || (fulfillment.status === "MANUAL_ACTION_REQUIRED" && isApprovedManualSupplierRetry(fulfillment.lastErrorCode))) {
    try {
      const detail = await syncSupplierFulfillment(db, fulfillmentId, client);
      return { claimed: false, submitted: true, reconciled: true, supplierStatus: detail.status };
    } catch (error) {
      if (!(error instanceof CjFulfillmentApiError) || error.code !== "CJ_ORDER_NOT_FOUND") throw error;
      if (fulfillment.status === "AMBIGUOUS") return { claimed: false, submitted: false, reconciled: true, status: "AMBIGUOUS" as const, code: error.code };
      const released = await db.supplierFulfillment.updateMany({ where: { id: fulfillmentId, status: "MANUAL_ACTION_REQUIRED", lastErrorCode: fulfillment.lastErrorCode }, data: { status: "RETRYABLE", lastErrorCategory: "RETRYABLE" } });
      if (released.count !== 1) return { claimed: false };
      return processSupplierFulfillment(db, fulfillmentId, client);
    }
  }
  throw new Error("FULFILLMENT_NOT_RETRYABLE");
}
