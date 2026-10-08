export type SellerOnboardingType = "PRIVATE" | "PROFESSIONAL";

export type SellerOnboardingIdentityFields = {
  sellerType: SellerOnboardingType | null;
  legalForm: string;
  companySubtype: string;
};

export function selectSellerOnboardingType(
  current: SellerOnboardingIdentityFields,
  sellerType: SellerOnboardingType,
): SellerOnboardingIdentityFields {
  return sellerType === "PRIVATE"
    ? { sellerType, legalForm: "", companySubtype: "" }
    : { ...current, sellerType };
}
