export type ConnectReadinessSeller = {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
};

export type ConnectReadinessState = "NOT_STARTED" | "ONBOARDING_INCOMPLETE" | "CHARGES_DISABLED" | "PAYOUTS_DISABLED" | "READY";

export function connectReadinessState(seller: ConnectReadinessSeller): ConnectReadinessState {
  if (!seller.stripeAccountId) return "NOT_STARTED";
  if (!seller.stripeOnboardingComplete) return "ONBOARDING_INCOMPLETE";
  if (!seller.stripeChargesEnabled) return "CHARGES_DISABLED";
  if (!seller.stripePayoutsEnabled) return "PAYOUTS_DISABLED";
  return "READY";
}

export function maskedStripeAccountId(accountId: string | null) {
  if (!accountId) return "—";
  return accountId.length <= 8 ? "••••" : `••••${accountId.slice(-6)}`;
}

export function connectReadinessCounts(sellers: ConnectReadinessSeller[]) {
  const counts = { total: sellers.length, withAccount: 0, withoutAccount: 0, incompleteOnboarding: 0, chargesDisabled: 0, payoutsDisabled: 0, ready: 0 };
  for (const seller of sellers) {
    if (!seller.stripeAccountId) counts.withoutAccount += 1;
    else counts.withAccount += 1;
    if (!seller.stripeOnboardingComplete) counts.incompleteOnboarding += 1;
    if (!seller.stripeChargesEnabled) counts.chargesDisabled += 1;
    if (!seller.stripePayoutsEnabled) counts.payoutsDisabled += 1;
    if (connectReadinessState(seller) === "READY") counts.ready += 1;
  }
  return { ...counts, compliance: counts.ready === counts.total ? "COMPLIANT" as const : "ACTION_REQUIRED" as const };
}
