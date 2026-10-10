import type { Prisma } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";

const EXTENSION_MARKER = /(?:;ext=|ext\.?|x)\s*\d+$/i;

function normalizeDigits(value: string) {
  return Array.from(value.normalize("NFKC"), (character) => {
    const point = character.codePointAt(0)!;
    if (point >= 0x660 && point <= 0x669) return String(point - 0x660);
    if (point >= 0x6f0 && point <= 0x6f9) return String(point - 0x6f0);
    return character;
  }).join("");
}

export function normalizeSellerAdminContactPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let input = normalizeDigits(value.trim());
  if (!input || input.length > 80 || EXTENSION_MARKER.test(input)) return null;
  input = input.replace(/[\s().\-]/g, "");
  if (input.startsWith("00")) input = `+${input.slice(2)}`;
  if (input.startsWith("+330")) input = `+33${input.slice(4)}`;
  const international = input.startsWith("+");
  const digits = international ? input.slice(1) : input;
  if (!/^\d+$/.test(digits) || /^0+$/.test(digits)) return null;
  if (international) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  return /^\d{7,20}$/.test(digits) ? digits : null;
}
export async function persistSellerAdminContactPhone(tx: Prisma.TransactionClient, input: { businessId: string; storeId: string; actorId: string; phone: string }) {
  const existing = await tx.sellerBusiness.findUnique({ where: { id: input.businessId }, select: { adminContactPhone: true } });
  if (!existing) throw new Error("SELLER_BUSINESS_NOT_FOUND");
  if (existing.adminContactPhone === input.phone) return false;
  await tx.sellerBusiness.update({ where: { id: input.businessId }, data: { adminContactPhone: input.phone } });
  await appendSellerBusinessAudit(tx, { businessId: input.businessId, storeId: input.storeId, actorId: input.actorId, category: "SELLER_CONTACT", action: "ADMIN_CONTACT_PHONE_UPDATED", targetType: "SELLER_BUSINESS", targetId: input.businessId, metadata: { source: "SELLER_ONBOARDING" } });
  return true;
}
