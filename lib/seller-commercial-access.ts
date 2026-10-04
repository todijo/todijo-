import { sellerPlanEntitlement } from "./seller-plans";
/** Accept only a server-resolved entitlement, never a client-submitted plan. */
export function sellerCapabilityTier(plan: string | null | undefined) {
  return plan === "admin-exempt" ? "pro" as const : sellerPlanEntitlement(plan)?.id ?? null;
}
export function hasProSellerCapabilities(plan: string | null | undefined) {
  return sellerCapabilityTier(plan) === "pro";
}
/** PRO features do not override the explicit one-Admin-owned-store policy. */
export function canCreateAdditionalSellerStore(plan: string | null | undefined) {
  return plan !== "admin-exempt" && hasProSellerCapabilities(plan);
}
export type CommercialInput = {
  role: string;
  subscription: { status: string; plan: string; currentPeriodEnd?: Date | null } | null;
  accessGrants: Array<{ source: string; plan?: string | null; startsAt: Date; endsAt: Date | null }>;
};
export function resolveSellerCommercialAccess(input: CommercialInput, now = new Date()) {
  if (input.role === "ADMIN") return { active: true, plan: "admin-exempt" as const, source: "ADMIN_EXEMPT" as const, expiresAt: null };
  const subscription = input.subscription;
  if (subscription && ["ACTIVE", "TRIALING"].includes(subscription.status) && subscription.currentPeriodEnd && subscription.currentPeriodEnd > now) {
    const plan = sellerPlanEntitlement(subscription.plan)?.id ?? null;
    if (plan) return { active: true, plan, source: "STRIPE" as const, expiresAt: subscription.currentPeriodEnd };
  }
  const grant = input.accessGrants.filter(item => item.source === "ADMIN_GRANTED" && item.startsAt <= now && item.endsAt !== null && item.endsAt > now && sellerPlanEntitlement(item.plan))
    .sort((a, b) => b.endsAt!.getTime() - a.endsAt!.getTime())[0];
  const plan = sellerPlanEntitlement(grant?.plan)?.id ?? null;
  return { active: Boolean(plan), plan, source: plan ? "ADMIN_GRANTED" as const : "NONE" as const, expiresAt: grant?.endsAt ?? null };
}
