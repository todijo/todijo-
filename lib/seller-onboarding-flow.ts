import { sellerRegistrationIntentQuery, type SellerRegistrationIntent } from "./seller-registration-intent";

type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED" | "NEEDS_INFORMATION";
type EntitlementSource = "STRIPE" | "ADMIN_GRANTED" | "ADMIN_EXEMPT" | "NONE";

export type SellerOnboardingState = {
  locale: string;
  intent: SellerRegistrationIntent | null;
  hasStore: boolean;
  hasDraft: boolean;
  onboardingStatus?: OnboardingStatus;
  onboardingStep?: number;
  entitlementSource?: EntitlementSource;
};

export function sellerOnboardingDestination(state: SellerOnboardingState) {
  const root = `/${state.locale}`;
  const intentQuery = sellerRegistrationIntentQuery(state.intent);
  if (!state.hasStore) {
    if (!state.hasDraft && !state.intent) return `${root}/sell#plans`;
    return `${root}/seller/onboarding${intentQuery}`;
  }
  const incomplete = (state.onboardingStep ?? 0) < 4 || ["NOT_STARTED", "IN_PROGRESS", "NEEDS_INFORMATION"].includes(state.onboardingStatus ?? "NOT_STARTED");
  if (incomplete) return `${root}/seller/onboarding${intentQuery}`;
  if (state.entitlementSource && state.entitlementSource !== "NONE") return `${root}/dashboard`;
  return `${root}/seller/subscription${intentQuery}`;
}
