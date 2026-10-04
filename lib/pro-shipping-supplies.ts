import type { PrismaClient } from "@prisma/client";
import { requireBusinessOwner } from "./seller-business-access";
import { sellerBusinessCommercialPlan } from "./seller-business";
import { hasProSellerCapabilities } from "./seller-commercial-access";
import { assertSellerActivity } from "./account-status";
import { validateSupportRequest } from "./support-request";
import { sellerFreeModelCopy } from "../i18n/seller-free-model";
export class ShippingSuppliesError extends Error { constructor(public readonly code: string, public readonly status = 403) { super(code); } }
export async function requireProShippingSupplies(db: PrismaClient, userId: string) {
  await assertSellerActivity(db, userId);
  const principal = await requireBusinessOwner(db, userId);
  if (!hasProSellerCapabilities(await sellerBusinessCommercialPlan(db, principal.businessId))) throw new ShippingSuppliesError("PRO_REQUIRED");
  return principal;
}
export async function requestProShippingSupplies(db: PrismaClient, userId: string, message: unknown, locale: string) {
  const principal = await requireProShippingSupplies(db, userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const input = validateSupportRequest({ category: "SELLER_SUPPORT", subject: sellerFreeModelCopy(locale).suppliesSubject, message }, user.email);
  if (!input) throw new ShippingSuppliesError("INVALID_REQUEST", 400);
  // Reuse the existing support queue; this is a request, not automated fulfillment.
  return db.supportRequest.create({ data: { userId, replyEmail: input.replyEmail, category: input.category, subject: input.subject, message: `[SellerBusiness ${principal.businessId}]\n${input.message}`, locale }, select: { id: true } });
}
