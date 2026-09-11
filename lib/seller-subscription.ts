import type { PrismaClient, SellerStatus, SellerType, SellerVatStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { activeAccessSource } from "./admin-access";
import { assertSellerActivity } from "./account-status";
import { sellerPlans } from "./seller-plans";

export const publishableSubscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function canPublish(store: {
  status: SellerStatus;
  sellerType?: SellerType;
  vatStatus?: SellerVatStatus;
  subscription: { status: SubscriptionStatus; currentPeriodEnd?: Date | null } | null;
  accessGrants?: Array<{ source: "ADMIN_GRANTED" | "ADMIN_EXEMPT"; startsAt: Date; endsAt: Date | null }>;
}, now = new Date()) {
  return store.status === "ACTIVE" && store.sellerType !== "UNKNOWN" && !(store.sellerType === "PROFESSIONAL" && store.vatStatus === "UNKNOWN") && activeAccessSource({ subscription: store.subscription, accessGrants: store.accessGrants ?? [] }, now).source !== "NONE";
}

export class SellerSubscriptionError extends Error {
  status = 403;
  code = "SELLER_SUBSCRIPTION_INACTIVE";
}

export function sellerProductQuota(input: { role: UserRole; plan: string | null | undefined; productCount: number }) {
  if (input.role === "ADMIN") return { productLimit: null, blocked: false };
  const productLimit = sellerPlans().find((plan) => plan.id === input.plan)?.productLimit ?? null;
  return { productLimit, blocked: productLimit !== null && input.productCount >= productLimit };
}

export async function requirePublishingAccess(db: PrismaClient, userId: string) {
  await assertSellerActivity(db,userId);
  const store = await db.store.findUnique({
    where: { ownerId: userId },
    select: {
      id: true, currency: true, status: true, sellerType: true, vatStatus: true,
      owner: { select: { role: true } },
      subscription: { select: { status: true, currentPeriodEnd: true, plan: true } },
      accessGrants: { where: { startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, select: { source: true, startsAt: true, endsAt: true } },
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
  const quota = sellerProductQuota({ role: store.owner.role, plan: store.subscription?.plan, productCount: store._count.products });
  if (quota.blocked) {
    throw Object.assign(new SellerSubscriptionError(`Your plan allows ${quota.productLimit} products and your store has reached that limit.`), { code: "SELLER_PRODUCT_LIMIT_REACHED" });
  }
  return store;
}
