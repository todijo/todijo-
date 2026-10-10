import type { UserRole } from "@prisma/client";

export type SellerLifecycleStatus =
  | "BUYER"
  | "SELLER_SETUP"
  | "ACTIVE_SELLER"
  | "RENEWAL_CANCELLED"
  | "SELLER_CLOSED"
  | "REACTIVATION_PENDING"
  | "ADMIN";

export type SellerLifecycleInput = {
  role: UserRole;
  sellerClosedAt?: Date | null;
  sellerSetupDraftExists?: boolean;
  store?: { onboardingStep: number; onboardingStatus: string } | null;
  reactivationStockReviewRequired?: boolean;
  subscription?: { status: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: Date | null } | null;
  now?: Date;
};

/**
 * Resolve the account-level seller lifecycle from persisted server state.
 * Commercial entitlement, Stripe readiness and permissions remain separate
 * authoritative gates; this value only describes the seller journey state.
 */
export function resolveSellerLifecycleStatus(input: SellerLifecycleInput): SellerLifecycleStatus {
  if (input.role === "ADMIN") return "ADMIN";
  if (input.sellerClosedAt) return "SELLER_CLOSED";

  if (input.role === "CUSTOMER") {
    return input.sellerSetupDraftExists || input.store ? "SELLER_SETUP" : "BUYER";
  }

  if (input.reactivationStockReviewRequired) return "REACTIVATION_PENDING";

  const store = input.store;
  if (!store || (store.onboardingStep < 4 && store.onboardingStatus !== "PENDING_REVIEW")) {
    return "SELLER_SETUP";
  }

  const subscription = input.subscription;
  const now = input.now ?? new Date();
  if (
    subscription?.cancelAtPeriodEnd
    && ["ACTIVE", "TRIALING"].includes(subscription.status)
    && subscription.currentPeriodEnd
    && subscription.currentPeriodEnd > now
  ) {
    return "RENEWAL_CANCELLED";
  }

  return "ACTIVE_SELLER";
}
