import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { assertSellerActivity } from "./account-status";
import { requireBusinessOwner, SellerCapabilityError } from "./seller-business-access";
import { sellerBusinessCommercialPlan, lockSellerBusiness } from "./seller-business";
import { hasProSellerCapabilities } from "./seller-commercial-access";

type Db = PrismaClient | Prisma.TransactionClient;
const reservedStatuses = ["REQUESTED", "APPROVED", "FULFILLED"] as const;

export class SellerBenefitError extends Error {
  constructor(public readonly code: string, public readonly status = 403) { super(code); }
}

export function sellerBenefitAccessAllowed(role: string | null | undefined, plan: string | null | undefined, enabled: boolean) {
  return role === "SELLER" && plan === "pro" && enabled;
}

export function sellerBenefitItemAvailable(item: { active: boolean; availableFrom: Date | null; availableUntil: Date | null }, now: Date) {
  return item.active && (!item.availableFrom || item.availableFrom <= now) && (!item.availableUntil || item.availableUntil > now);
}

export function sellerBenefitQuantityFits(limit: number, reserved: number, requested: number) {
  return Number.isSafeInteger(limit) && Number.isSafeInteger(reserved) && Number.isSafeInteger(requested) && requested > 0 && reserved >= 0 && reserved + requested <= limit;
}

export async function requireSellerBenefitAccess(db: Db, userId: string) {
  await assertSellerActivity(db, userId);
  const principal = await requireBusinessOwner(db, userId);
  const owner = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  const plan = await sellerBusinessCommercialPlan(db, principal.businessId);
  if (owner?.role !== "SELLER" || !hasProSellerCapabilities(plan)) {
    throw new SellerBenefitError("PRO_REQUIRED", 403);
  }
  const access = await db.sellerBenefitAccess.findUnique({ where: { businessId: principal.businessId }, select: { enabled: true } });
  if (!sellerBenefitAccessAllowed(owner.role, plan, access?.enabled === true)) {
    if (owner.role !== "SELLER" || !hasProSellerCapabilities(plan)) throw new SellerBenefitError("PRO_REQUIRED", 403);
    throw new SellerBenefitError("ADMIN_ACCESS_REQUIRED", 403);
  }
  return principal;
}

export async function listSellerBenefits(db: PrismaClient, userId: string, storeId: string, now = new Date()) {
  const principal = await requireSellerBenefitAccess(db, userId);
  const store = await db.store.findFirst({ where: { id: storeId, ownerId: principal.ownerId, businessId: principal.businessId }, select: { id: true, name: true } });
  if (!store) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  const items = await db.sellerBenefitCatalogItem.findMany({ where: { active: true, AND: [{ OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] }, { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] }] }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  const decorated = await Promise.all(items.map(async item => {
    const used = await db.sellerBenefitRequest.aggregate({ where: { businessId: principal.businessId, storeId, itemId: item.id, status: { in: [...reservedStatuses] } }, _sum: { quantity: true } });
    const requested = used._sum.quantity ?? 0;
    const remaining = Math.max(0, item.quantityLimitPerStore - requested);
    return { ...item, remaining, unavailable: !sellerBenefitItemAvailable(item, now) || remaining === 0 };
  }));
  return { businessId: principal.businessId, store, items: decorated };
}

export async function requestSellerBenefit(db: PrismaClient, input: { userId: string; storeId: string; itemId: string; quantity: number; idempotencyKey: string }, now = new Date()) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw new SellerBenefitError("INVALID_QUANTITY", 400);
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey)) throw new SellerBenefitError("INVALID_REQUEST", 400);
  const initial = await requireSellerBenefitAccess(db, input.userId);
  try {
    return await db.$transaction(async tx => {
      await lockSellerBusiness(tx, initial.businessId);
      const principal = await requireSellerBenefitAccess(tx, input.userId);
      const store = await tx.store.findFirst({ where: { id: input.storeId, ownerId: principal.ownerId, businessId: principal.businessId }, select: { id: true } });
      if (!store) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
      await tx.$queryRaw`SELECT "id" FROM "SellerBenefitCatalogItem" WHERE "id"=${input.itemId} FOR UPDATE`;
      const existing = await tx.sellerBenefitRequest.findUnique({ where: { businessId_storeId_idempotencyKey: { businessId: principal.businessId, storeId: store.id, idempotencyKey: input.idempotencyKey } } });
      if (existing) {
        if (existing.itemId !== input.itemId || existing.quantity !== input.quantity) throw new SellerBenefitError("IDEMPOTENCY_CONFLICT", 409);
        return existing;
      }
      const item = await tx.sellerBenefitCatalogItem.findUnique({ where: { id: input.itemId } });
      if (!item || !sellerBenefitItemAvailable(item, now)) throw new SellerBenefitError("ITEM_UNAVAILABLE", 409);
      if (item.priceType === "FREE" ? item.priceMinor !== 0 : item.priceMinor <= 0) throw new SellerBenefitError("ITEM_UNAVAILABLE", 409);
      const usage = await tx.sellerBenefitRequest.aggregate({ where: { businessId: principal.businessId, storeId: store.id, itemId: item.id, status: { in: [...reservedStatuses] } }, _sum: { quantity: true } });
      if (!sellerBenefitQuantityFits(item.quantityLimitPerStore, usage._sum.quantity ?? 0, input.quantity)) throw new SellerBenefitError("QUANTITY_LIMIT_REACHED", 409);
      const request = await tx.sellerBenefitRequest.create({ data: { businessId: principal.businessId, storeId: store.id, itemId: item.id, requestedById: input.userId, quantity: input.quantity, priceTypeSnapshot: item.priceType, unitPriceMinorSnapshot: item.priceMinor, idempotencyKey: input.idempotencyKey } });
      await tx.sellerBenefitAuditEvent.create({ data: { actorId: input.userId, businessId: principal.businessId, itemId: item.id, requestId: request.id, action: "SELLER_BENEFIT_REQUESTED", metadata: { storeId: store.id, quantity: input.quantity, priceType: item.priceType, unitPriceMinor: item.priceMinor } } });
      return request;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await db.sellerBenefitRequest.findUnique({ where: { businessId_storeId_idempotencyKey: { businessId: initial.businessId, storeId: input.storeId, idempotencyKey: input.idempotencyKey } } });
      if (duplicate && duplicate.itemId === input.itemId && duplicate.quantity === input.quantity) return duplicate;
      if (duplicate) throw new SellerBenefitError("IDEMPOTENCY_CONFLICT", 409);
    }
    throw error;
  }
}

export async function setSellerBenefitAccess(db: PrismaClient, input: { businessId: string; adminId: string; enabled: boolean }) {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "SellerBusiness" WHERE "id"=${input.businessId} FOR UPDATE`);
    if (!rows.length) throw new SellerBenefitError("BUSINESS_NOT_FOUND", 404);
    const business = await tx.sellerBusiness.findUnique({ where: { id: input.businessId }, select: { ownerId: true, owner: { select: { role: true } } } });
    if (business?.owner.role !== "SELLER") throw new SellerBenefitError("SELLER_REQUIRED", 409);
    if (input.enabled && !hasProSellerCapabilities(await sellerBusinessCommercialPlan(tx, input.businessId))) throw new SellerBenefitError("PRO_REQUIRED", 409);
    const updated = await tx.sellerBenefitAccess.upsert({ where: { businessId: input.businessId }, create: { businessId: input.businessId, enabled: input.enabled, updatedById: input.adminId }, update: { enabled: input.enabled, updatedById: input.adminId } });
    await tx.sellerBenefitAuditEvent.create({ data: { actorId: input.adminId, businessId: input.businessId, action: input.enabled ? "ADMIN_BENEFIT_ACCESS_ENABLED" : "ADMIN_BENEFIT_ACCESS_DISABLED", metadata: { enabled: input.enabled } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export type SellerBenefitItemInput = { id?: string; name: string; description: string; priceType: "FREE" | "SPECIAL"; priceMinor: number; quantityLimitPerStore: number; active: boolean; availableFrom: Date | null; availableUntil: Date | null };
export async function saveSellerBenefitItem(db: PrismaClient, input: SellerBenefitItemInput & { adminId: string }) {
  if (!input.name.trim() || input.name.trim().length > 160 || input.description.trim().length > 1200 || !Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0 || input.priceType === "FREE" && input.priceMinor !== 0 || input.priceType === "SPECIAL" && input.priceMinor === 0 || !Number.isSafeInteger(input.quantityLimitPerStore) || input.quantityLimitPerStore < 1 || input.quantityLimitPerStore > 10000 || input.availableFrom && input.availableUntil && input.availableUntil <= input.availableFrom) throw new SellerBenefitError("INVALID_ITEM", 400);
  return db.$transaction(async tx => {
    if (input.id) await tx.$queryRaw`SELECT "id" FROM "SellerBenefitCatalogItem" WHERE "id"=${input.id} FOR UPDATE`;
    const data = { name: input.name.trim(), description: input.description.trim(), priceType: input.priceType, priceMinor: input.priceMinor, quantityLimitPerStore: input.quantityLimitPerStore, active: input.active, availableFrom: input.availableFrom, availableUntil: input.availableUntil, updatedById: input.adminId };
    const item = input.id
      ? await tx.sellerBenefitCatalogItem.update({ where: { id: input.id }, data })
      : await tx.sellerBenefitCatalogItem.create({ data: { ...data, createdById: input.adminId } });
    await tx.sellerBenefitAuditEvent.create({ data: { actorId: input.adminId, itemId: item.id, action: input.id ? "ADMIN_BENEFIT_ITEM_UPDATED" : "ADMIN_BENEFIT_ITEM_CREATED", metadata: { name: item.name, priceType: item.priceType, priceMinor: item.priceMinor, quantityLimitPerStore: item.quantityLimitPerStore, active: item.active } } });
    return item;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewSellerBenefitRequest(db: PrismaClient, input: { requestId: string; adminId: string; status: "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELED"; reviewNote?: string }) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "SellerBenefitRequest" WHERE "id"=${input.requestId} FOR UPDATE`;
    const request = await tx.sellerBenefitRequest.findUnique({ where: { id: input.requestId }, include: { item: true } });
    if (!request) throw new SellerBenefitError("REQUEST_NOT_FOUND", 404);
    await lockSellerBusiness(tx, request.businessId);
    if (request.status === "FULFILLED" || request.status === "REJECTED" || request.status === "CANCELED" || request.status === "REQUESTED" && input.status === "FULFILLED" || request.status === "APPROVED" && input.status === "APPROVED") throw new SellerBenefitError("INVALID_TRANSITION", 409);
    if (input.status === "APPROVED") {
      const usage = await tx.sellerBenefitRequest.aggregate({ where: { businessId: request.businessId, storeId: request.storeId, itemId: request.itemId, status: { in: [...reservedStatuses] }, id: { not: request.id } }, _sum: { quantity: true } });
      if (!sellerBenefitQuantityFits(request.item.quantityLimitPerStore, usage._sum.quantity ?? 0, request.quantity)) throw new SellerBenefitError("QUANTITY_LIMIT_REACHED", 409);
      if (!sellerBenefitItemAvailable(request.item, new Date())) throw new SellerBenefitError("ITEM_UNAVAILABLE", 409);
    }
    const updated = await tx.sellerBenefitRequest.update({ where: { id: request.id }, data: { status: input.status, reviewedById: input.adminId, reviewedAt: new Date(), reviewNote: input.reviewNote?.trim().slice(0, 1000) || null } });
    await tx.sellerBenefitAuditEvent.create({ data: { actorId: input.adminId, businessId: request.businessId, itemId: request.itemId, requestId: request.id, action: `ADMIN_BENEFIT_REQUEST_${input.status}`, metadata: { previousStatus: request.status, status: input.status, reviewNote: input.reviewNote?.trim().slice(0, 1000) ?? "" } } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
