import "server-only";
import { Prisma, type PrismaClient, type SupplierProvider } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;
type RecallIdentity = { provider: SupplierProvider | "GTIN"; kind: "PRODUCT" | "VARIANT" | "SKU"; value: string };

export class ProductRecallError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}

const exact = (value: string | null | undefined) => {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > 200) throw new ProductRecallError("RECALL_IDENTIFIER_INVALID", 422);
  return normalized;
};
const distinct = (keys: RecallIdentity[]) => [...new Map(keys.map(key => [`${key.provider}:${key.kind}:${key.value}`, key])).values()];

/** Only supplier-issued identifiers qualify. Names and images never do. */
export function recallKeys(input: { provider: SupplierProvider; supplierProductId?: string | null; supplierSku?: string | null; variants?: Array<{ supplierVariantId?: string | null; supplierSku?: string | null }> }): RecallIdentity[] {
  const keys: RecallIdentity[] = [];
  const productId = exact(input.supplierProductId);
  if (productId) keys.push({ provider: input.provider, kind: "PRODUCT", value: productId });
  const sku = exact(input.supplierSku);
  if (sku) keys.push({ provider: input.provider, kind: "SKU", value: sku });
  for (const variant of input.variants ?? []) {
    const id = exact(variant.supplierVariantId);
    if (id) keys.push({ provider: input.provider, kind: "VARIANT", value: id });
    const variantSku = exact(variant.supplierSku);
    if (variantSku) keys.push({ provider: input.provider, kind: "SKU", value: variantSku });
  }
  return distinct(keys);
}

/** A checksum-valid GTIN is the only shared non-supplier identity accepted. Arbitrary seller text is not. */
export function gtinRecallKeys(value: string | null | undefined): RecallIdentity[] {
  const digits = value?.trim() ?? "";
  if (!/^(?:\d{8}|\d{12,14})$/.test(digits)) return [];
  const body = digits.slice(0, -1);
  const sum = [...body].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  if ((10 - sum % 10) % 10 !== Number(digits.at(-1))) return [];
  return [{ provider: "GTIN", kind: "PRODUCT", value: digits.padStart(14, "0") }];
}

export async function matchingActiveRecall(db: Database, keys: RecallIdentity[]) {
  if (!keys.length) return null;
  return db.productRecall.findFirst({ where: { status: "ACTIVE", keys: { some: { OR: keys.map(key => ({ provider: key.provider, kind: key.kind, value: key.value })) } } }, select: { id: true, reference: true } });
}

export async function assertNotRecalled(db: Database, keys: RecallIdentity[]) {
  if (await matchingActiveRecall(db, keys)) throw new ProductRecallError("PRODUCT_RECALLED");
}

export async function productRecallKeys(db: Database, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, productIdentifier: true, supplierLink: { select: { provider: true, supplierProductId: true, supplierSku: true } }, variants: { select: { supplierVariantId: true, supplierSku: true } } } });
  if (!product) throw new ProductRecallError("PRODUCT_NOT_FOUND", 404);
  const keys = distinct([...(product.supplierLink ? recallKeys({ ...product.supplierLink, variants: product.variants }) : []), ...gtinRecallKeys(product.productIdentifier)]);
  if (!keys.length) throw new ProductRecallError("AUTHORITATIVE_RECALL_IDENTITY_REQUIRED", 422);
  return keys;
}

function relatedProductsWhere(keys: RecallIdentity[]): Prisma.ProductWhereInput {
  const providers = [...new Set(keys.map(key => key.provider))];
  return { OR: providers.map(provider => {
    const scoped = keys.filter(key => key.provider === provider);
    const ids = scoped.filter(key => key.kind === "PRODUCT").map(key => key.value);
    if (provider === "GTIN") {
      const representations = ids.flatMap(value => [8, 12, 13, 14].map(length => value.slice(-length)).filter(candidate => candidate.padStart(14, "0") === value));
      return { productIdentifier: { in: [...new Set(representations)] } };
    }
    const variants = scoped.filter(key => key.kind === "VARIANT").map(key => key.value);
    const skus = scoped.filter(key => key.kind === "SKU").map(key => key.value);
    return { OR: [
      { supplierLink: { is: { provider, OR: [{ supplierProductId: { in: ids } }, { supplierSku: { in: skus } }] } } },
      { variants: { some: { supplierProvider: provider, OR: [{ supplierVariantId: { in: variants } }, { supplierSku: { in: skus } }] } } },
    ] };
  }) };
}

function storedRecallKeys(keys: Array<{ provider: string; kind: string; value: string }>): RecallIdentity[] {
  return keys.map(key => {
    if ((key.provider !== "CJ" && key.provider !== "GTIN") || !["PRODUCT", "VARIANT", "SKU"].includes(key.kind)) throw new ProductRecallError("RECALL_IDENTITY_INVALID", 500);
    return key as RecallIdentity;
  });
}

export async function createPlatformRecall(db: PrismaClient, adminId: string, input: { productId: string; reason: string; evidence?: string; reference?: string }) {
  const reason = input.reason?.trim();
  if (!reason || reason.length > 1000 || (input.evidence?.length ?? 0) > 2000 || (input.reference?.length ?? 0) > 300) throw new ProductRecallError("RECALL_REASON_INVALID", 400);
  const keys = await productRecallKeys(db, input.productId);
  const existing = await db.productRecallKey.findFirst({ where: { OR: keys }, select: { recallId: true, recall: { select: { status: true } } } });
  if (existing) throw new ProductRecallError(existing.recall.status === "ACTIVE" ? "PRODUCT_ALREADY_RECALLED" : "RECALL_REACTIVATION_REQUIRES_REVIEW");
  try {
    return await db.$transaction(async tx => {
      const affected = await tx.product.findMany({ where: relatedProductsWhere(keys), select: { id: true, storeId: true, deactivationReason: true, store: { select: { ownerId: true, name: true } } } });
      const recall = await tx.productRecall.create({ data: { reason, evidence: input.evidence?.trim() || null, reference: input.reference?.trim() || null, createdById: adminId, keys: { create: keys }, events: { create: { actorId: adminId, action: "ACTIVATED", metadata: { productId: input.productId, affected: affected.map(item => ({ id: item.id, priorReason: item.deactivationReason })) } } } } });
      if (affected.length) await tx.product.updateMany({ where: { id: { in: affected.map(item => item.id) } }, data: { status: "DRAFT", deactivationReason: "ADMIN" } });
      return { recall, affected };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ProductRecallError("PRODUCT_ALREADY_RECALLED");
    throw error;
  }
}

export async function revokePlatformRecall(db: PrismaClient, adminId: string, recallId: string, reason: string) {
  const note = reason?.trim();
  if (!note || note.length > 1000) throw new ProductRecallError("REVOCATION_REASON_INVALID", 400);
  return db.$transaction(async tx => {
    const updated = await tx.productRecall.updateMany({ where: { id: recallId, status: "ACTIVE" }, data: { status: "REVOKED", revokedById: adminId, revokedAt: new Date(), revocationReason: note } });
    if (!updated.count) throw new ProductRecallError("ACTIVE_RECALL_NOT_FOUND", 404);
    await tx.productRecallEvent.create({ data: { recallId, actorId: adminId, action: "REVOKED", metadata: { reason: note } } });
    // Existing listings remain on ADMIN hold. Revocation never silently republishes them.
    return { id: recallId, status: "REVOKED" as const };
  });
}

export async function reactivatePlatformRecall(db: PrismaClient, adminId: string, recallId: string, reason: string) {
  const note = reason?.trim();
  if (!note || note.length > 1000) throw new ProductRecallError("REACTIVATION_REASON_INVALID", 400);
  return db.$transaction(async tx => {
    const recall = await tx.productRecall.findUnique({ where: { id: recallId }, include: { keys: true } });
    if (!recall || recall.status !== "REVOKED") throw new ProductRecallError("REVOKED_RECALL_NOT_FOUND", 404);
    const changed = await tx.productRecall.updateMany({ where: { id: recallId, status: "REVOKED" }, data: { status: "ACTIVE", revokedById: null, revokedAt: null, revocationReason: null } });
    if (changed.count !== 1) throw new ProductRecallError("RECALL_CONCURRENT_CHANGE", 409);
    const keys = storedRecallKeys(recall.keys);
    const affected = await tx.product.findMany({ where: relatedProductsWhere(keys), select: { id: true, deactivationReason: true } });
    if (affected.length) await tx.product.updateMany({ where: { id: { in: affected.map(item => item.id) } }, data: { status: "DRAFT", deactivationReason: "ADMIN" } });
    await tx.productRecallEvent.create({ data: { recallId, actorId: adminId, action: "REACTIVATED", metadata: { reason: note, affected: affected.map(item => ({ id: item.id, priorReason: item.deactivationReason })) } } });
    return { id: recallId, status: "ACTIVE" as const, affectedCount: affected.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Explicit audited release of this recall's hold; never republishes or clears an unrelated admin hold. */
export async function releaseRecallListing(db: PrismaClient, adminId: string, recallId: string, productId: string, reason: string) {
  const note = reason?.trim();
  if (!note || note.length > 1000) throw new ProductRecallError("RELEASE_REASON_INVALID", 400);
  return db.$transaction(async tx => {
    const recall = await tx.productRecall.findUnique({ where: { id: recallId }, select: { status: true, events: { where: { action: { in: ["ACTIVATED", "REACTIVATED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, metadata: true } } } });
    if (!recall || recall.status !== "REVOKED") throw new ProductRecallError("RECALL_NOT_REVOKED", 409);
    const event = recall.events[0];
    const metadata = event?.metadata;
    const entries = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).affected : null;
    const entry = Array.isArray(entries) ? entries.find(value => value && typeof value === "object" && value.id === productId) as { priorReason?: unknown } | undefined : undefined;
    if (!entry || entry.priorReason === "ADMIN") throw new ProductRecallError("RECALL_HOLD_NOT_OWNED", 409);
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, removedAt: true, deactivationReason: true, productIdentifier: true, supplierLink: { select: { provider: true, supplierProductId: true, supplierSku: true } }, variants: { select: { supplierVariantId: true, supplierSku: true } }, reports: { where: { events: { some: { action: "UNPUBLISH", createdAt: { gt: event.createdAt } } } }, select: { id: true }, take: 1 } } });
    if (!product || product.removedAt || product.deactivationReason !== "ADMIN" || product.reports.length) throw new ProductRecallError("LISTING_RELEASE_BLOCKED", 409);
    await assertNotRecalled(tx, [...(product.supplierLink ? recallKeys({ ...product.supplierLink, variants: product.variants }) : []), ...gtinRecallKeys(product.productIdentifier)]);
    const changed = await tx.product.updateMany({ where: { id: productId, removedAt: null, deactivationReason: "ADMIN", status: "DRAFT" }, data: { deactivationReason: "SELLER" } });
    if (changed.count !== 1) throw new ProductRecallError("LISTING_RELEASE_CONFLICT", 409);
    await tx.productRecallEvent.create({ data: { recallId, actorId: adminId, action: "LISTING_RELEASED", metadata: { productId, reason: note, previousReason: "ADMIN", newReason: "SELLER", status: "DRAFT" } } });
    return { productId, status: "DRAFT" as const, deactivationReason: "SELLER" as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function affectedRecallListings(db: PrismaClient, recallId: string) {
  const recall = await db.productRecall.findUnique({ where: { id: recallId }, include: { keys: true, events: { orderBy: { createdAt: "desc" } } } });
  if (!recall) throw new ProductRecallError("RECALL_NOT_FOUND", 404);
  const latest = recall.events.find(event => event.action === "ACTIVATED" || event.action === "REACTIVATED");
  const metadata = latest?.metadata;
  const entries = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).affected : null;
  const prior = new Map(Array.isArray(entries) ? entries.flatMap(value => value && typeof value === "object" && typeof value.id === "string" ? [[value.id, value.priorReason]] as const : []) : []);
  const products = await db.product.findMany({ where: relatedProductsWhere(storedRecallKeys(recall.keys)), select: { id: true, name: true, status: true, removedAt: true, deactivationReason: true, store: { select: { id: true, name: true, ownerId: true } }, reports: latest ? { where: { events: { some: { action: "UNPUBLISH", createdAt: { gt: latest.createdAt } } } }, select: { id: true }, take: 1 } : false } });
  return { recall, products: products.map(product => ({ id: product.id, name: product.name, status: product.status, deactivationReason: product.deactivationReason, store: product.store,
    releasable: recall.status === "REVOKED" && prior.has(product.id) && prior.get(product.id) !== "ADMIN" && product.deactivationReason === "ADMIN" && !product.removedAt && !product.reports.length,
  })) };
}
