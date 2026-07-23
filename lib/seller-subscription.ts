import type { PrismaClient, SellerStatus, SubscriptionStatus } from "@prisma/client";

export const publishableSubscriptionStatuses: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function canPublish(store: { status: SellerStatus; subscription: { status: SubscriptionStatus } | null }) {
  return store.status === "ACTIVE" && Boolean(store.subscription && publishableSubscriptionStatuses.includes(store.subscription.status));
}

export class SellerSubscriptionError extends Error {
  status = 403;
  code = "SELLER_SUBSCRIPTION_INACTIVE";
}

export async function requirePublishingAccess(db: PrismaClient, userId: string) {
  const store = await db.store.findUnique({
    where: { ownerId: userId },
    select: { id: true, currency: true, status: true, subscription: { select: { status: true } } },
  });
  if (!store) throw Object.assign(new SellerSubscriptionError("Create your store first."), { code: "STORE_REQUIRED" });
  if (!canPublish(store)) throw new SellerSubscriptionError("Your seller subscription is inactive. Renew your monthly plan to publish or reactivate products.");
  return store;
}
