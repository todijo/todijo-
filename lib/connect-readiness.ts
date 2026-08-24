export type ConnectReadinessSeller = {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
};

export function connectReadinessCounts(sellers: ConnectReadinessSeller[]) {
  const counts = { total: sellers.length, withAccount: 0, withoutAccount: 0, incompleteOnboarding: 0, chargesDisabled: 0, payoutsDisabled: 0, ready: 0 };
  for (const seller of sellers) {
    if (!seller.stripeAccountId) counts.withoutAccount += 1;
    else counts.withAccount += 1;
    if (!seller.stripeOnboardingComplete) counts.incompleteOnboarding += 1;
    if (!seller.stripeChargesEnabled) counts.chargesDisabled += 1;
    if (!seller.stripePayoutsEnabled) counts.payoutsDisabled += 1;
    if (seller.stripeAccountId && seller.stripeOnboardingComplete && seller.stripeChargesEnabled && seller.stripePayoutsEnabled) counts.ready += 1;
  }
  return counts;
}
