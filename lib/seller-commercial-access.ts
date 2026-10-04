import { sellerPlanEntitlement } from "./seller-plans";
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
    return { active: Boolean(plan), plan, source: plan ? "STRIPE" as const : "NONE" as const, expiresAt: subscription.currentPeriodEnd };
  }
  const grant = input.accessGrants.filter(item => item.source === "ADMIN_GRANTED" && item.startsAt <= now && item.endsAt !== null && item.endsAt > now && sellerPlanEntitlement(item.plan))
    .sort((a, b) => b.endsAt!.getTime() - a.endsAt!.getTime())[0];
  const plan = sellerPlanEntitlement(grant?.plan)?.id ?? null;
  return { active: Boolean(plan), plan, source: plan ? "ADMIN_GRANTED" as const : "NONE" as const, expiresAt: grant?.endsAt ?? null };
}
