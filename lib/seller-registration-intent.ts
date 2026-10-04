import { isSellerBillingInterval, isPaidSellerPlanId, type SellerBillingInterval, type SellerPlanId } from "./seller-plans";

export type SellerRegistrationIntent = {
  plan: SellerPlanId;
  interval: SellerBillingInterval;
};

export function sellerRegistrationIntent(plan: unknown, interval: unknown): SellerRegistrationIntent | null {
  if (!isPaidSellerPlanId(plan)) return null;
  if (interval !== undefined && interval !== null && interval !== "" && !isSellerBillingInterval(interval)) return null;
  return { plan, interval: isSellerBillingInterval(interval) ? interval : "monthly" };
}

export function explicitSellerRegistrationIntent(plan: unknown, interval: unknown): SellerRegistrationIntent | null {
  if (!isPaidSellerPlanId(plan) || !isSellerBillingInterval(interval)) return null;
  return { plan, interval };
}

export function sellerRegistrationIntentQuery(intent: SellerRegistrationIntent | null) {
  if (!intent) return "";
  return `?plan=${encodeURIComponent(intent.plan)}&interval=${encodeURIComponent(intent.interval)}`;
}

export function sellerOnboardingPath(locale: string, hasStore: boolean, intent: SellerRegistrationIntent | null) {
  if (!intent) return `/${locale}/dashboard`;
  const destination = hasStore ? "seller/subscription" : "seller/onboarding";
  return `/${locale}/${destination}${sellerRegistrationIntentQuery(intent)}`;
}
