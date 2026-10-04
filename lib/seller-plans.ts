export const sellerPlanIds = ["free", "plus", "pro"] as const;
export const paidSellerPlanIds = ["plus", "pro"] as const;
export const sellerBillingIntervals = ["monthly", "annual"] as const;

export type SellerPlanId = (typeof sellerPlanIds)[number];
export type SellerBillingInterval = (typeof sellerBillingIntervals)[number];

export type SellerPlan = {
  id: SellerPlanId;
  name: string;
  currency: "EUR";
  monthlyAmountMinor: number;
  annualAmountMinor: number;
  productLimit: number | null;
  dropshipping: boolean;
  priceIds: Record<SellerBillingInterval, string>;
};

const planDefinitions: ReadonlyArray<Omit<SellerPlan, "priceIds">> = [
  { id: "free", name: "FREE", currency: "EUR", monthlyAmountMinor: 0, annualAmountMinor: 0, productLimit: 5, dropshipping: false },
  { id: "plus", name: "Plus", currency: "EUR", monthlyAmountMinor: 1499, annualAmountMinor: 14390, productLimit: 50, dropshipping: false },
  { id: "pro", name: "Pro", currency: "EUR", monthlyAmountMinor: 2699, annualAmountMinor: 25910, productLimit: null, dropshipping: true },
];

const priceEnvironmentKeys: Record<Exclude<SellerPlanId, "free">, Record<SellerBillingInterval, string>> = {
  plus: { monthly: "STRIPE_SELLER_PLUS_MONTHLY_PRICE_ID", annual: "STRIPE_SELLER_PLUS_ANNUAL_PRICE_ID" },
  pro: { monthly: "STRIPE_SELLER_PRO_MONTHLY_PRICE_ID", annual: "STRIPE_SELLER_PRO_ANNUAL_PRICE_ID" },
};

export function isSellerPlanId(value: unknown): value is SellerPlanId {
  return typeof value === "string" && sellerPlanIds.includes(value as SellerPlanId);
}

export function isSellerBillingInterval(value: unknown): value is SellerBillingInterval {
  return typeof value === "string" && sellerBillingIntervals.includes(value as SellerBillingInterval);
}

export function isPaidSellerPlanId(value: unknown): value is Exclude<SellerPlanId, "free"> {
  return value === "plus" || value === "pro";
}

export function sellerPlans(): SellerPlan[] {
  return planDefinitions.map((plan) => ({
    ...plan,
    priceIds: {
      monthly: plan.id === "free" ? "" : process.env[priceEnvironmentKeys[plan.id].monthly] ?? "",
      annual: plan.id === "free" ? "" : process.env[priceEnvironmentKeys[plan.id].annual] ?? "",
    },
  }));
}

export function configuredSellerPlan(planId: unknown, interval: unknown) {
  if (!isPaidSellerPlanId(planId) || !isSellerBillingInterval(interval)) return null;
  const plan = sellerPlans().find((candidate) => candidate.id === planId);
  const priceId = plan?.priceIds[interval] ?? "";
  if (!plan || !/^price_[A-Za-z0-9]+$/.test(priceId)) return null;
  return { ...plan, interval, priceId, amountMinor: interval === "monthly" ? plan.monthlyAmountMinor : plan.annualAmountMinor };
}

export function configuredSellerPlanForPriceId(priceId: unknown) {
  if (typeof priceId !== "string" || !/^price_[A-Za-z0-9]+$/.test(priceId)) return null;
  const matches = sellerPlans().flatMap((plan) => sellerBillingIntervals
    .filter((billingInterval) => plan.priceIds[billingInterval] === priceId)
    .map((billingInterval) => ({ plan: plan.id, billingInterval, priceId })));
  return matches.length === 1 ? matches[0] : null;
}

export function canonicalActiveSellerPlanId(subscription: { status: string; plan: string;currentPeriodEnd?:Date|null } | null | undefined,now=new Date()) {
  if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status)||!subscription.currentPeriodEnd||subscription.currentPeriodEnd<=now) return null;
  return isPaidSellerPlanId(subscription.plan) ? subscription.plan : null;
}

export function sellerPlanEntitlement(planId: unknown) {
  if (!isSellerPlanId(planId)) return null;
  return sellerPlans().find((plan) => plan.id === planId) ?? null;
}
