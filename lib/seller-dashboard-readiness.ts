export type SellerBusinessVerificationMessage = "dashboardPending" | "manualReview" | "partialData" | "mismatch" | "notFound" | "unavailable";

const transientReasons = new Set(["NOT_CONFIGURED", "RATE_LIMITED", "TIMEOUT", "UPSTREAM_ERROR", "INVALID_RESPONSE", "RETRY_LATER"]);

export function sellerBusinessVerificationMessage(input: {
  businessState?: string | null;
  businessReason?: string | null;
  establishmentState?: string | null;
  establishmentReason?: string | null;
}): SellerBusinessVerificationMessage {
  const reasons = [input.establishmentReason, input.businessReason].filter((value): value is string => Boolean(value));
  if (reasons.some((reason) => ["SIRET_SIREN_MISMATCH", "SIREN_MISMATCH"].includes(reason))) return "mismatch";
  if (reasons.includes("NOT_FOUND")) return "notFound";
  if (reasons.includes("PUBLIC_DATA_INCOMPLETE")) return "partialData";
  if (reasons.includes("INACTIVE_OR_CLOSED") || reasons.includes("BUSINESS_IDENTIFIER_IN_USE") || input.businessState === "MANUAL_REVIEW" || input.establishmentState === "MANUAL_REVIEW") return "manualReview";
  if (reasons.some((reason) => transientReasons.has(reason))) return "unavailable";
  if (input.businessState === "PENDING" || input.establishmentState === "PENDING") return "unavailable";
  return "dashboardPending";
}
