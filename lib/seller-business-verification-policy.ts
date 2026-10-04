export function isFrenchProfessional(sellerType: string | null | undefined, country: string | null | undefined) {
  const normalized = String(country ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  return sellerType === "PROFESSIONAL" && (normalized === "FR" || normalized === "FRANCE");
}
export function publicStoreCity(input: { sellerType?: string | null; country?: string | null; displayBusinessAddress?: boolean | null; city?: string | null }) {
  return isFrenchProfessional(input.sellerType, input.country) && !input.displayBusinessAddress ? "" : input.city ?? "";
}

export function hasVerifiedFrenchBusiness(input: { sellerType?: string | null; country?: string | null; businessRegistrationId?: string | null; business?: { siren?: string | null; inseeVerificationState?: string | null } | null; establishment?: { siret?: string | null; legalUnitSiren?: string | null; verificationState?: string | null } | null }) {
  if (!isFrenchProfessional(input.sellerType, input.country)) return true;
  return input.business?.inseeVerificationState === "VERIFIED" && Boolean(input.business.siren) && input.establishment?.verificationState === "VERIFIED" && input.establishment.legalUnitSiren === input.business.siren && input.establishment.siret === input.businessRegistrationId && input.establishment.siret?.slice(0, 9) === input.business.siren;
}
