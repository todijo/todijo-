export type SellerOnboardingCompletion =
  | { kind: "ACTIVATE"; storeStatus: "ACTIVE"; onboardingStatus: "VERIFIED" }
  | { kind: "ADMIN_REVIEW"; storeStatus: "PENDING"; onboardingStatus: "PENDING_REVIEW" }
  | { kind: "VERIFICATION_REQUIRED" };

/**
 * Completed ordinary seller onboarding is self-service. Admin review is reserved
 * for the existing exceptional French INSEE manual-review outcome.
 */
export function sellerOnboardingCompletion(input: {
  professional: boolean;
  country: string;
  businessState?: string | null;
  establishmentState?: string | null;
}): SellerOnboardingCompletion {
  if (!input.professional || input.country.toUpperCase() !== "FR") {
    return { kind: "ACTIVATE", storeStatus: "ACTIVE", onboardingStatus: "VERIFIED" };
  }

  if (input.businessState === "VERIFIED" && input.establishmentState === "VERIFIED") {
    return { kind: "ACTIVATE", storeStatus: "ACTIVE", onboardingStatus: "VERIFIED" };
  }

  const businessCanRequireReview = input.businessState === "MANUAL_REVIEW" || input.businessState === "VERIFIED";
  if (businessCanRequireReview && input.establishmentState === "MANUAL_REVIEW") {
    return { kind: "ADMIN_REVIEW", storeStatus: "PENDING", onboardingStatus: "PENDING_REVIEW" };
  }

  return { kind: "VERIFICATION_REQUIRED" };
}
