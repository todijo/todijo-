import "server-only";
import type { PrismaClient } from "@prisma/client";
import { assertSellerActivity } from "./account-status";
import { requireBusinessOwner } from "./seller-business-access";
import { sellerBusinessCommercialPlan } from "./seller-business";
import { hasProSellerCapabilities } from "./seller-commercial-access";

export class ProProductImportError extends Error {
  constructor(public readonly code: string, public readonly status = 403) { super(code); }
}

/** Seller product import is owner-only and uses the effective business entitlement. */
export async function requireProProductImport(db: PrismaClient, userId: string) {
  await assertSellerActivity(db, userId);
  const principal = await requireBusinessOwner(db, userId);
  if (!hasProSellerCapabilities(await sellerBusinessCommercialPlan(db, principal.businessId))) {
    throw new ProProductImportError("PRO_PRODUCT_IMPORT_REQUIRED");
  }
  return principal;
}
