import type { PrismaClient, SellerStatus, SellerType, SubscriptionStatus } from "@prisma/client";
import { activeAccessSource } from "./admin-access";

export const publishableSubscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function canPublish(store: {
  status: SellerStatus;
  sellerType?: SellerType;
  subscription: { status: SubscriptionStatus; currentPeriodEnd?: Date | null } | null;
  accessGrants?: Array<{ source: "ADMIN_GRANTED" | "ADMIN_EXEMPT"; startsAt: Date; endsAt: Date | null }>;
}, now = new Date()) {
  return store.status === "ACTIVE" && store.sellerType !== "UNKNOWN" && activeAccessSource({ subscription: store.subscription, accessGrants: store.accessGrants ?? [] }, now).source !== "NONE";
}

export class SellerSubscriptionError extends Error {
  status = 403;
  code = "SELLER_SUBSCRIPTION_INACTIVE";
}

export async function requirePublishingAccess(db: PrismaClient, userId: string) {
  const store = await db.store.findUnique({
    where: { ownerId: userId },
    select: {
      id: true, currency: true, status: true, sellerType: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
      accessGrants: { where: { startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, select: { source: true, startsAt: true, endsAt: true } },
    },
  });
  if (!store) throw Object.assign(new SellerSubscriptionError("Create your store first."), { code: "STORE_REQUIRED" });
  if (store.sellerType === "UNKNOWN") throw Object.assign(new SellerSubscriptionError("Confirm your seller status in store settings before publishing products."), { code: "SELLER_TYPE_REQUIRED" });
  if (!canPublish(store)) throw new SellerSubscriptionError("Your seller subscription is inactive. Renew your monthly plan to publish or reactivate products.");
  return store;
}
