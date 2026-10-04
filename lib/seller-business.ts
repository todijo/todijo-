import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { resolveSellerCommercialAccess } from "./seller-commercial-access";

export class SellerBusinessError extends Error { constructor(public readonly code: string, public readonly status = 400) { super(code); } }

export async function ensureSellerBusiness(tx: Prisma.TransactionClient, ownerId: string, primaryStoreId?: string | null) {
  const business = await tx.sellerBusiness.upsert({ where: { ownerId }, create: { ownerId, billingStoreId: primaryStoreId ?? null }, update: {}, select: { id: true, billingStoreId: true, maxStores: true } });
  if (primaryStoreId) {
    await tx.store.updateMany({ where: { id: primaryStoreId, ownerId, businessId: null }, data: { businessId: business.id } });
    await tx.user.updateMany({ where: { id: ownerId, primaryStoreId: null }, data: { primaryStoreId } });
    if (!business.billingStoreId) await tx.sellerBusiness.update({ where: { id: business.id }, data: { billingStoreId: primaryStoreId } });
  }
  return business;
}

export async function sellerBusinessCommercialEntitlement(db: PrismaClient | Prisma.TransactionClient, businessId: string, now = new Date()) {
  const business = await db.sellerBusiness.findUnique({ where: { id: businessId }, select: { owner: { select: { role: true } }, billingStore: { select: { id:true, subscription: { select: { status: true, plan: true, currentPeriodEnd:true } }, accessGrants: { select: { source: true, plan: true, startsAt: true, endsAt: true } } } } } });
  if (!business?.billingStore) return {businessId,billingStoreId:null,active:false,plan:null,source:"NONE" as const,expiresAt:null};
  return { businessId, billingStoreId: business.billingStore.id, ...resolveSellerCommercialAccess({ role: business.owner.role, subscription: business.billingStore.subscription, accessGrants: business.billingStore.accessGrants }, now) };
}

export async function sellerBusinessCommercialPlan(db: PrismaClient | Prisma.TransactionClient, businessId: string, now = new Date()) {
  return (await sellerBusinessCommercialEntitlement(db,businessId,now)).plan;
}

export async function lockSellerBusiness(tx: Prisma.TransactionClient, businessId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; maxStores: number }>>(Prisma.sql`SELECT "id", "maxStores" FROM "SellerBusiness" WHERE "id"=${businessId} FOR UPDATE`);
  if (rows.length !== 1) throw new SellerBusinessError("BUSINESS_NOT_FOUND", 404);
  return rows[0];
}
