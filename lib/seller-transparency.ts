import type { SellerType } from "@prisma/client";

export const confirmedSellerTypes = ["PROFESSIONAL", "PRIVATE"] as const;

export function parseSellerType(value: unknown): SellerType | null {
  return confirmedSellerTypes.includes(value as (typeof confirmedSellerTypes)[number]) ? value as SellerType : null;
}

function optionalText(value: unknown, limit: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, limit) : null;
}

export function sellerIdentityInput(body: Record<string, unknown>, sellerType: SellerType) {
  if (sellerType !== "PROFESSIONAL") return { legalBusinessName: null, businessRegistrationId: null, businessAddress: null, businessPostalCode: null, vatNumber: null };
  const legalBusinessName = optionalText(body.legalBusinessName, 160);
  if (!legalBusinessName) throw new Error("LEGAL_BUSINESS_NAME_REQUIRED");
  return {
    legalBusinessName,
    businessRegistrationId: optionalText(body.businessRegistrationId, 120),
    businessAddress: optionalText(body.businessAddress, 240),
    businessPostalCode: optionalText(body.businessPostalCode, 40),
    vatNumber: optionalText(body.vatNumber, 60),
  };
}
