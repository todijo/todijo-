export type SellerOnboardingCompletion =
  | { kind: "VERIFIED"; storeStatus: "PENDING"; onboardingStatus: "VERIFIED" }
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
  siretProvided?: boolean;
  registrationDocumentSubmitted?: boolean;
  registrationDocumentAccepted?: boolean;
}): SellerOnboardingCompletion {
  if (!input.professional || input.country.toUpperCase() !== "FR") {
    return { kind: "VERIFIED", storeStatus: "PENDING", onboardingStatus: "VERIFIED" };
  }

  if (!input.registrationDocumentSubmitted) return { kind: "VERIFICATION_REQUIRED" };

  // A French professional may submit a SIREN and the required registration
  // document before selecting an establishment. That is a legitimate review
  // state, not a malformed onboarding request.
  if (!input.siretProvided) return { kind: "ADMIN_REVIEW", storeStatus: "PENDING", onboardingStatus: "PENDING_REVIEW" };

  if (input.businessState === "VERIFIED" && input.establishmentState === "VERIFIED" && input.registrationDocumentAccepted) {
    return { kind: "VERIFIED", storeStatus: "PENDING", onboardingStatus: "VERIFIED" };
  }

  const documentCanRequireReview = input.registrationDocumentSubmitted;
  if (documentCanRequireReview) {
    return { kind: "ADMIN_REVIEW", storeStatus: "PENDING", onboardingStatus: "PENDING_REVIEW" };
  }

  return { kind: "VERIFICATION_REQUIRED" };
}
