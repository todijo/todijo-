import type { Prisma, PrismaClient } from "@prisma/client";

export type AddressInput = {
  recipientName: string; addressLine1: string; addressLine2: string | null;
  postalCode: string; city: string; country: string; state: string | null; phone: string | null;
};

export function validateAddressInput(body: unknown): { ok: true; value: AddressInput } | { ok: false; code: "INVALID_ADDRESS" } {
  const raw = typeof body === "object" && body ? body as Record<string, unknown> : {};
  const country = String(raw.country ?? "").trim().toUpperCase();
  const value: AddressInput = {
    recipientName: String(raw.recipientName ?? "").trim(), addressLine1: String(raw.addressLine1 ?? "").trim(),
    addressLine2: String(raw.addressLine2 ?? "").trim() || null, postalCode: String(raw.postalCode ?? "").trim(),
    city: String(raw.city ?? "").trim(), country, state: String(raw.state ?? "").trim() || null,
    phone: String(raw.phone ?? "").trim() || null,
  };
  if (!value.recipientName || !value.addressLine1 || !value.postalCode || !value.city || !/^[A-Z]{2}$/.test(country)) return { ok: false, code: "INVALID_ADDRESS" };
  if (value.recipientName.length > 160 || value.addressLine1.length > 240 || (value.addressLine2?.length ?? 0) > 240 || value.postalCode.length > 32 || value.city.length > 120 || (value.state?.length ?? 0) > 120 || (value.phone?.length ?? 0) > 40) return { ok: false, code: "INVALID_ADDRESS" };
  return { ok: true, value };
}

type Db = PrismaClient | Prisma.TransactionClient;
export async function defaultBuyerAddress(db: Db, userId: string) {
  return db.buyerShippingAddress.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }] });
}

export async function createBuyerAddress(db: Db, userId: string, value: AddressInput, makeDefault = false) {
  const count = await db.buyerShippingAddress.count({ where: { userId } });
  const isDefault = makeDefault || count === 0;
  if (isDefault) await db.buyerShippingAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  return db.buyerShippingAddress.create({ data: { ...value, userId, isDefault } });
}

export async function chooseDefaultBuyerAddress(db: Db, userId: string, addressId: string) {
  const owned = await db.buyerShippingAddress.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!owned) return null;
  await db.buyerShippingAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  return db.buyerShippingAddress.update({ where: { id: owned.id }, data: { isDefault: true } });
}

export async function deleteBuyerAddress(db: Db, userId: string, addressId: string) {
  const owned = await db.buyerShippingAddress.findFirst({ where: { id: addressId, userId } });
  if (!owned) return false;
  await db.buyerShippingAddress.delete({ where: { id: owned.id } });
  if (owned.isDefault) {
    const replacement = await db.buyerShippingAddress.findFirst({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    if (replacement) await db.buyerShippingAddress.update({ where: { id: replacement.id }, data: { isDefault: true } });
  }
  return true;
}
