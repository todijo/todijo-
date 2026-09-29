import { LoyaltySettingsError } from "./loyalty-settings";

/** Imported/supplier-linked products can never opt in, even via a forged body. */
export function productLoyaltyEligibility(
  requested: unknown,
  hasSupplierLink: boolean,
  previous = false,
): boolean {
  if (requested === undefined) return hasSupplierLink ? false : previous;
  if (typeof requested !== "boolean") throw new LoyaltySettingsError("INVALID_PRODUCT_LOYALTY");
  if (hasSupplierLink && requested) throw new LoyaltySettingsError("DROPSHIPPING_LOYALTY_FORBIDDEN", 409);
  return hasSupplierLink ? false : requested;
}
