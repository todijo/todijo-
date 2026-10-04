import type { Prisma, PrismaClient } from "@prisma/client";
import { sellerBusinessCommercialPlan } from "./seller-business";
import { sellerPlanEntitlement } from "./seller-plans";
import { lockSellerProductQuota } from "./seller-subscription";

/** Preserve the oldest published products, never delete or automatically republish. */
export async function enforceSellerPublicationCapacity(db: PrismaClient | Prisma.TransactionClient, storeId: string, businessId: string | null, now = new Date()): Promise<{ count: number }> {
  if ("$transaction" in db) return db.$transaction(tx => enforceSellerPublicationCapacity(tx, storeId, businessId, now));
  const stores = businessId ? await db.store.findMany({ where: { businessId }, orderBy: { id: "asc" }, select: { id: true } }) : [{ id: storeId }];
  for (const store of stores) await lockSellerProductQuota(db, store.id);
  const plan = businessId ? await sellerBusinessCommercialPlan(db, businessId, now) : "free";
  const tier = sellerPlanEntitlement(plan);
  const limit = plan === "admin-exempt" ? null : tier ? tier.productLimit : 5;
  if (limit === null) return { count: 0 };
  return db.product.updateMany({ where: { storeId: { in: stores.map(store => store.id) }, status: "PUBLISHED", removedAt: null,
    OR: [{ freeVisibilityPosition: { gt: limit } }, { freeVisibilityPosition: null }] },
    data: { status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" } });
}
