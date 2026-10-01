export const sellerLegalForms = ["PRIVATE", "SOLE_TRADER", "COMPANY", "ASSOCIATION", "OTHER"] as const;
export type SellerLegalFormCode = (typeof sellerLegalForms)[number];

export const franceCompanySubtypes = [
  "SAS",
  "SASU",
  "SARL",
  "EURL",
  "SA",
  "SNC",
  "SCS",
  "SCA",
  "SOCIETE_CIVILE",
  "SOCIETE_EXERCICE_LIBERAL",
  "SOCIETE_COOPERATIVE",
  "SOCIETE_EUROPEENNE",
  "OTHER_COMPANY",
] as const;
export type SellerCompanySubtypeCode = (typeof franceCompanySubtypes)[number];

type LegalIdentityInput = {
  sellerType: "PRIVATE" | "PROFESSIONAL" | null;
  country: string | null;
  legalForm: unknown;
  companySubtype: unknown;
};

export type SellerLegalIdentity = {
  legalForm: SellerLegalFormCode;
  companySubtype: SellerCompanySubtypeCode | null;
};

export type SellerLegalIdentityError =
  | "INVALID_SELLER_TYPE"
  | "COUNTRY_REQUIRED"
  | "LEGAL_FORM_REQUIRED"
  | "INVALID_LEGAL_FORM"
  | "COMPANY_SUBTYPE_REQUIRED"
  | "INVALID_COMPANY_SUBTYPE";

const legalFormSet = new Set<string>(sellerLegalForms);
const subtypeSet = new Set<string>(franceCompanySubtypes);
const value = (input: unknown) => typeof input === "string" && input.trim() ? input.trim() : null;

export function sellerLegalIdentity(input: LegalIdentityInput, options: { allowIncomplete?: boolean } = {}): { identity: SellerLegalIdentity | null; error: SellerLegalIdentityError | null } {
  const legalForm = value(input.legalForm);
  const companySubtype = value(input.companySubtype);
  if (!input.sellerType) return options.allowIncomplete ? { identity: null, error: null } : { identity: null, error: "INVALID_SELLER_TYPE" };
  if (input.sellerType === "PRIVATE") {
    if ((legalForm && legalForm !== "PRIVATE") || companySubtype) return { identity: null, error: companySubtype ? "INVALID_COMPANY_SUBTYPE" : "INVALID_LEGAL_FORM" };
    return { identity: { legalForm: "PRIVATE", companySubtype: null }, error: null };
  }
  if (!input.country) return options.allowIncomplete ? { identity: null, error: null } : { identity: null, error: "COUNTRY_REQUIRED" };
  if (!legalForm) return options.allowIncomplete ? { identity: null, error: null } : { identity: null, error: "LEGAL_FORM_REQUIRED" };
  if (!legalFormSet.has(legalForm) || legalForm === "PRIVATE") return { identity: null, error: "INVALID_LEGAL_FORM" };
  if (input.country === "FR" && legalForm === "COMPANY") {
    if (!companySubtype) return options.allowIncomplete ? { identity: { legalForm: "COMPANY", companySubtype: null }, error: null } : { identity: null, error: "COMPANY_SUBTYPE_REQUIRED" };
    if (!subtypeSet.has(companySubtype)) return { identity: null, error: "INVALID_COMPANY_SUBTYPE" };
    return { identity: { legalForm: "COMPANY", companySubtype: companySubtype as SellerCompanySubtypeCode }, error: null };
  }
  if (companySubtype) return { identity: null, error: "INVALID_COMPANY_SUBTYPE" };
  return { identity: { legalForm: legalForm as SellerLegalFormCode, companySubtype: null }, error: null };
}
