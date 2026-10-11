import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { resolveSellerCommercialAccess, sellerCapabilityTier } from "./seller-commercial-access";

export class SellerBusinessError extends Error { constructor(public readonly code: string, public readonly status = 400) { super(code); } }

export async function ensureSellerBusiness(tx: Prisma.TransactionClient, ownerId: string, primaryStoreId?: string | null) {
  let business = await tx.sellerBusiness.upsert({ where: { ownerId }, create: { ownerId, primaryStoreId: primaryStoreId ?? null, billingStoreId: primaryStoreId ?? null }, update: {}, select: { id: true, primaryStoreId: true, billingStoreId: true, maxStores: true } });
  if (!primaryStoreId) return business;

  const store = await tx.store.findUnique({ where: { id: primaryStoreId }, select: { id: true, ownerId: true, businessId: true } });
  if (!store || store.ownerId !== ownerId || (store.businessId && store.businessId !== business.id)) throw new SellerBusinessError("BUSINESS_STORE_IDENTITY_CONFLICT", 409);
  if (!store.businessId) {
    const linked = await tx.store.updateMany({ where: { id: primaryStoreId, ownerId, businessId: null }, data: { businessId: business.id } });
    if (linked.count !== 1) throw new SellerBusinessError("BUSINESS_STORE_IDENTITY_CONFLICT", 409);
  }

  const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { primaryStoreId: true } });
  const establishedPrimaryId = business.primaryStoreId ?? owner?.primaryStoreId ?? business.billingStoreId ?? primaryStoreId;
  const establishedPrimary = await tx.store.findUnique({ where: { id: establishedPrimaryId }, select: { id: true, ownerId: true, businessId: true } });
  if (!establishedPrimary || establishedPrimary.ownerId !== ownerId || (establishedPrimary.businessId && establishedPrimary.businessId !== business.id)) throw new SellerBusinessError("BUSINESS_PRIMARY_STORE_IDENTITY_CONFLICT", 409);
  if (!establishedPrimary.businessId) {
    const linked = await tx.store.updateMany({ where: { id: establishedPrimaryId, ownerId, businessId: null }, data: { businessId: business.id } });
    if (linked.count !== 1) throw new SellerBusinessError("BUSINESS_PRIMARY_STORE_IDENTITY_CONFLICT", 409);
  }
  if (!business.primaryStoreId) {
    const assigned = await tx.sellerBusiness.updateMany({ where: { id: business.id, primaryStoreId: null }, data: { primaryStoreId: establishedPrimaryId } });
    if (assigned.count !== 1) throw new SellerBusinessError("BUSINESS_PRIMARY_STORE_IDENTITY_CONFLICT", 409);
  }
  if (owner && !owner.primaryStoreId) await tx.user.updateMany({ where: { id: ownerId, primaryStoreId: null }, data: { primaryStoreId: establishedPrimaryId } });

  // Only fill a missing billing pointer when existing financial/access state
  // has one unambiguous anchor. Never move subscriptions, customers or grants.
  if (!business.billingStoreId) {
    const anchoredStores = await tx.store.findMany({ where: { businessId: business.id, OR: [{ stripeCustomerId: { not: null } }, { subscription: { isNot: null } }, { accessGrants: { some: {} } }] }, select: { id: true } });
    const anchorIds = [...new Set(anchoredStores.map(item => item.id))];
    const billingStoreId = anchorIds.length === 1 ? anchorIds[0] : anchorIds.length === 0 ? establishedPrimaryId : null;
    if (billingStoreId) {
      await tx.sellerBusiness.updateMany({ where: { id: business.id, billingStoreId: null }, data: { billingStoreId } });
    }
  }
  business = await tx.sellerBusiness.findUniqueOrThrow({ where: { id: business.id }, select: { id: true, primaryStoreId: true, billingStoreId: true, maxStores: true } });
  return business;
}

export async function sellerBusinessCommercialEntitlement(db: PrismaClient | Prisma.TransactionClient, businessId: string, now = new Date()) {
  const business = await db.sellerBusiness.findUnique({ where: { id: businessId }, select: { primaryStoreId:true, billingStoreId:true, owner: { select: { role: true } }, billingStore: { select: { id:true, subscription: { select: { status: true, plan: true, currentPeriodEnd:true } }, accessGrants: { select: { source: true, plan: true, startsAt: true, endsAt: true } } } } } });
  if (!business?.billingStore) return {businessId,primaryStoreId:business?.primaryStoreId??null,billingStoreId:business?.billingStoreId??null,billingAnchorMismatch:Boolean(business?.primaryStoreId&&business?.billingStoreId&&business.primaryStoreId!==business.billingStoreId),active:false,plan:null,source:"NONE" as const,expiresAt:null};
  return { businessId, primaryStoreId:business.primaryStoreId??null, billingStoreId: business.billingStore.id, billingAnchorMismatch:Boolean(business.primaryStoreId&&business.primaryStoreId!==business.billingStore.id), ...resolveSellerCommercialAccess({ role: business.owner.role, subscription: business.billingStore.subscription, accessGrants: business.billingStore.accessGrants }, now) };
}

export async function isBusinessPrimaryStore(db: PrismaClient | Prisma.TransactionClient, businessId: string, storeId: string) {
  const business = await db.sellerBusiness.findUnique({ where: { id: businessId }, select: { primaryStoreId: true } });
  return business?.primaryStoreId === storeId;
}

export async function sellerBusinessCommercialPlan(db: PrismaClient | Prisma.TransactionClient, businessId: string, now = new Date()) {
  return (await sellerBusinessCommercialEntitlement(db,businessId,now)).plan;
}
export async function sellerBusinessCapabilityTier(db: PrismaClient | Prisma.TransactionClient, businessId: string, now = new Date()) {
  return sellerCapabilityTier(await sellerBusinessCommercialPlan(db, businessId, now));
}

export async function lockSellerBusiness(tx: Prisma.TransactionClient, businessId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; maxStores: number; billingStoreId: string | null }>>(Prisma.sql`SELECT "id", "maxStores", "billingStoreId" FROM "SellerBusiness" WHERE "id"=${businessId} FOR UPDATE`);
  if (rows.length !== 1) throw new SellerBusinessError("BUSINESS_NOT_FOUND", 404);
  return rows[0];
}
