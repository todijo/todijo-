import type { SellerType, SellerVatStatus } from "@prisma/client";

export const confirmedSellerTypes = ["PROFESSIONAL", "PRIVATE"] as const;

export function parseSellerType(value: unknown): SellerType | null {
  return confirmedSellerTypes.includes(value as (typeof confirmedSellerTypes)[number]) ? value as SellerType : null;
}

function optionalText(value: unknown, limit: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, limit) : null;
}

export function sellerIdentityInput(body: Record<string, unknown>, sellerType: SellerType) {
  if (sellerType !== "PROFESSIONAL") return { legalBusinessName: null, businessRegistrationId: null, businessAddress: null, businessPostalCode: null, vatNumber: null, vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" as SellerVatStatus };
  const legalBusinessName = optionalText(body.legalBusinessName, 160);
  if (!legalBusinessName) throw new Error("LEGAL_BUSINESS_NAME_REQUIRED");
  const vatStatus = body.vatStatus === "REGISTERED" || body.vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE" ? body.vatStatus as SellerVatStatus : null;
  if (!vatStatus) throw new Error("VAT_STATUS_REQUIRED");
  const vatNumber = optionalText(body.vatNumber, 60);
  if (vatStatus === "REGISTERED" && !vatNumber) throw new Error("VAT_NUMBER_REQUIRED");
  return {
    legalBusinessName,
    businessRegistrationId: optionalText(body.businessRegistrationId, 120),
    businessAddress: optionalText(body.businessAddress, 240),
    businessPostalCode: optionalText(body.businessPostalCode, 40),
    vatNumber: vatStatus === "REGISTERED" ? vatNumber : null,
    vatStatus,
  };
}
