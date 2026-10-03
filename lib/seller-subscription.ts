import type { PrismaClient, SellerStatus, SellerType, SellerVatStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { activeAccessSource } from "./admin-access";
import { assertSellerActivity } from "./account-status";
import { sellerPlanEntitlement, type SellerPlanId } from "./seller-plans";
import { requireStoreCapability } from "./seller-business-access";
import { sellerBusinessCommercialPlan } from "./seller-business";

export const publishableSubscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function canPublish(store: {
  status: SellerStatus;
  sellerType?: SellerType;
  vatStatus?: SellerVatStatus;
  subscription: { status: SubscriptionStatus; currentPeriodEnd?: Date | null } | null;
  accessGrants?: Array<{ source: "ADMIN_GRANTED" | "ADMIN_EXEMPT"; startsAt: Date; endsAt: Date | null }>;
}, now = new Date(), businessPlan?: SellerPlanId | "admin-exempt" | null) {
  const commercialAccess = businessPlan === undefined ? activeAccessSource({ subscription: store.subscription, accessGrants: store.accessGrants ?? [] }, now).source !== "NONE" : businessPlan !== null;
  return store.status === "ACTIVE" && store.sellerType !== "UNKNOWN" && !(store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN") && commercialAccess;
}

export class SellerSubscriptionError extends Error {
  status = 403;
  code = "SELLER_SUBSCRIPTION_INACTIVE";
}

export function sellerProductQuota(input: { role: UserRole; plan: string | null | undefined; productCount: number }) {
  if (input.role === "ADMIN") return { productLimit: null, blocked: false };
  const productLimit = sellerPlanEntitlement(input.plan)?.productLimit;
  if (productLimit === undefined) return { productLimit: null, blocked: true };
  return { productLimit, blocked: productLimit !== null && input.productCount >= productLimit };
}

export function effectiveSellerPlan(input: {
  role: UserRole;
  subscription: { status: SubscriptionStatus; plan: string; currentPeriodEnd?: Date | null } | null;
  accessGrants: Array<{ source: "ADMIN_GRANTED" | "ADMIN_EXEMPT"; plan?: string | null; startsAt: Date; endsAt: Date | null }>;
}, now = new Date()): SellerPlanId | "admin-exempt" | null {
  if (input.role === "ADMIN") return "admin-exempt";
  if (input.subscription && publishableSubscriptionStatuses.includes(input.subscription.status) && input.subscription.currentPeriodEnd && input.subscription.currentPeriodEnd > now) {
    return sellerPlanEntitlement(input.subscription.plan)?.id ?? null;
  }
  const grant = input.accessGrants
    .filter((candidate) => candidate.source === "ADMIN_GRANTED" && candidate.startsAt <= now && candidate.endsAt !== null && candidate.endsAt > now)
    .sort((a, b) => b.endsAt!.getTime() - a.endsAt!.getTime())[0];
  return sellerPlanEntitlement(grant?.plan)?.id ?? null;
}

export async function requirePublishingAccess(db: PrismaClient, userId: string) {
  await assertSellerActivity(db,userId);
  const store = await db.store.findFirst({
    where: { ownerId: userId },
    select: {
      id: true, currency: true, status: true, sellerType: true, vatStatus: true,
      owner: { select: { role: true } },
      subscription: { select: { status: true, currentPeriodEnd: true, plan: true } },
      accessGrants: { where: { startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, select: { source: true, plan: true, startsAt: true, endsAt: true } },
      _count: { select: { products: true } },
    },
  });
  if (!store) throw Object.assign(new SellerSubscriptionError("Create your store first."), { code: "STORE_REQUIRED" });
  if (store.sellerType === "UNKNOWN") throw Object.assign(new SellerSubscriptionError("Confirm your seller status in store settings before publishing products."), { code: "SELLER_TYPE_REQUIRED" });
  if (store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN") throw Object.assign(new SellerSubscriptionError("Confirm your VAT status in store settings before publishing products."), { code: "VAT_STATUS_REQUIRED" });
  if (!canPublish(store)) throw new SellerSubscriptionError("Your seller subscription is inactive. Renew your monthly plan to publish or reactivate products.");
  return store;
}

export async function requireProductCreationAccess(db: PrismaClient, userId: string) {
  const store = await requirePublishingAccess(db, userId);
  const plan = effectiveSellerPlan({ role: store.owner.role, subscription: store.subscription, accessGrants: store.accessGrants });
  const quota = sellerProductQuota({ role: store.owner.role, plan, productCount: store._count.products });
  if (quota.blocked) {
    throw Object.assign(new SellerSubscriptionError(`Your plan allows ${quota.productLimit} products and your store has reached that limit.`), { code: "SELLER_PRODUCT_LIMIT_REACHED" });
  }
  return store;
}

export async function requireStorePublishingAccess(db: PrismaClient, userId: string, storeId: string, permission: "PRODUCT_CREATE"|"PRODUCT_PUBLISH" = "PRODUCT_CREATE") {
  await assertSellerActivity(db,userId);
  const principal=await requireStoreCapability(db,userId,storeId,permission);
  const store=await db.store.findUnique({where:{id:storeId},select:{id:true,currency:true,status:true,sellerType:true,vatStatus:true,_count:{select:{products:true}}}});
  if(!store)throw Object.assign(new SellerSubscriptionError("Create your store first."),{code:"STORE_REQUIRED"});
  if(store.sellerType==="UNKNOWN")throw Object.assign(new SellerSubscriptionError("Confirm your seller status in store settings before publishing products."),{code:"SELLER_TYPE_REQUIRED"});
  if(store.sellerType==="PROFESSIONAL"&&store.vatStatus==="UNKNOWN")throw Object.assign(new SellerSubscriptionError("Confirm your VAT status in store settings before publishing products."),{code:"VAT_STATUS_REQUIRED"});
  const plan=await sellerBusinessCommercialPlan(db,principal.businessId);
  if(store.status!=="ACTIVE"||!plan)throw new SellerSubscriptionError("Your seller subscription is inactive. Renew your plan to publish or reactivate products.");
  const quota=sellerProductQuota({role:plan==="admin-exempt"?"ADMIN":"SELLER",plan,productCount:store._count.products});
  if(quota.blocked)throw Object.assign(new SellerSubscriptionError(`Your plan allows ${quota.productLimit} products and this store has reached that limit.`),{code:"SELLER_PRODUCT_LIMIT_REACHED"});
  return store;
}
