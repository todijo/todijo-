import type { Prisma, PrismaClient } from "@prisma/client";
import { AdminAccessError } from "./admin-access-error";
type Db = PrismaClient | Prisma.TransactionClient;
export const managedOwnerSelect = {
  id: true, firstName: true, lastName: true, email: true, role: true, primaryStoreId: true,
  store: { select: { id: true, ownerId: true, businessId: true } },
  sellerSuspendedAt: true, deactivatedAt: true, blockedAt: true, blockExpiresAt: true,
  _count: { select: { stores: true } },
  ownedBusiness: { select: { id: true, billingStoreId: true, billingStore: { select: { id: true, ownerId: true, businessId: true } }, _count: { select: { stores: true } } } },
} as const;
export type ManagedOwner = Prisma.UserGetPayload<{ select: typeof managedOwnerSelect }>;
export type OwnerEligibility = { eligible: boolean; reason: string | null; mode: "FIRST" | "ADDITIONAL"; businessId: string | null };
export async function managedOwnerEligibility(db: Db, owner: ManagedOwner | null, adminId: string, now = new Date()): Promise<OwnerEligibility> {
  const deny = (reason: string): OwnerEligibility => ({ eligible: false, reason, mode: "FIRST", businessId: owner?.ownedBusiness?.id ?? null });
  if (!owner) return deny("OWNER_NOT_FOUND");
  if (owner.sellerSuspendedAt || owner.deactivatedAt || owner.blockedAt && (!owner.blockExpiresAt || owner.blockExpiresAt > now)) return deny("OWNER_RESTRICTED");
  if (owner.id === adminId) {
    if (owner.role !== "ADMIN") return deny("OWNER_INELIGIBLE");
    if (owner._count.stores === 0 && (owner.primaryStoreId || owner.store)) return deny("OWNER_STATE_CHANGED");
    return { eligible: true, reason: null, mode: owner._count.stores === 0 ? "FIRST" : "ADDITIONAL", businessId: null };
  }
  if (owner.role !== "SELLER") return deny("OWNER_INELIGIBLE");
  if (owner._count.stores === 0) {
    if (owner.primaryStoreId || owner.store || owner.ownedBusiness && (owner.ownedBusiness._count.stores !== 0 || owner.ownedBusiness.billingStoreId !== null || owner.ownedBusiness.billingStore)) return deny("OWNER_STATE_CHANGED");
    return { eligible: true, reason: null, mode: "FIRST", businessId: owner.ownedBusiness?.id ?? null };
  }
  const business = owner.ownedBusiness;
  if (!business || business._count.stores !== owner._count.stores) return deny("OWNER_BUSINESS_INCONSISTENT");
  if (!business.billingStoreId || business.billingStore?.id !== business.billingStoreId || business.billingStore.ownerId !== owner.id || business.billingStore.businessId !== business.id) return deny("OWNER_BUSINESS_INCONSISTENT");
  if (owner.primaryStoreId && (owner.store?.id !== owner.primaryStoreId || owner.store.ownerId !== owner.id || owner.store.businessId !== business.id)) return deny("OWNER_BUSINESS_INCONSISTENT");
  return { eligible: true, reason: null, mode: "ADDITIONAL", businessId: business.id };
}
export async function requireManagedOwner(db: Db, ownerId: string, adminId: string, now = new Date()) {
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: managedOwnerSelect });
  const eligibility = await managedOwnerEligibility(db, owner, adminId, now);
  if (!eligibility.eligible) throw new AdminAccessError(eligibility.reason!, eligibility.reason === "OWNER_NOT_FOUND" ? 404 : 409, eligibility.reason!);
  return { owner: owner!, ...eligibility };
}
export async function lockManagedOwner(tx: Prisma.TransactionClient, ownerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${ownerId} FOR UPDATE`;
}
export async function listManagedOwners(db: Db, adminId: string, search = "") {
  const q = search.trim().slice(0, 100);
  const users = await db.user.findMany({
    where: { AND: [{ OR: [{ role: "SELLER" }, { id: adminId, role: "ADMIN" }] }, ...(q ? [{ OR: ["firstName", "lastName", "email"].map(field => ({ [field]: { contains: q, mode: "insensitive" as const } })) }] : [])] },
    select: managedOwnerSelect, orderBy: [{ firstName: "asc" }, { id: "asc" }],
  });
  const eligible = await Promise.all(users.map(async user => (await managedOwnerEligibility(db, user, adminId)).eligible ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } : null));
  return [...new Map(eligible.filter(user => user !== null).map(user => [user.id, user])).values()];
}
