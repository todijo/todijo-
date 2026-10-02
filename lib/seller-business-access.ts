import "server-only";
import type { Prisma, PrismaClient, TeamPermission, SubscriptionStatus, UserRole } from "@prisma/client";
import { sellerPlanEntitlement } from "./seller-plans";

type Db = PrismaClient | Prisma.TransactionClient;
type TeamBusinessEntitlement={owner:{role:UserRole};billingStore:{subscription:{status:SubscriptionStatus;plan:string}|null;accessGrants:Array<{source:"ADMIN_GRANTED"|"ADMIN_EXEMPT";plan:string|null;startsAt:Date;endsAt:Date|null}>}|null};
function hasProTeamEntitlement(business:TeamBusinessEntitlement,now=new Date()){
  if(business.billingStore?.subscription&&["ACTIVE","TRIALING"].includes(business.billingStore.subscription.status))return sellerPlanEntitlement(business.billingStore.subscription.plan)?.id==="pro";
  return Boolean(business.billingStore?.accessGrants.some(grant=>grant.source==="ADMIN_GRANTED"&&grant.startsAt<=now&&grant.endsAt!==null&&grant.endsAt>now&&sellerPlanEntitlement(grant.plan)?.id==="pro"));
}

export class SellerCapabilityError extends Error {
  constructor(public readonly code: "AUTH_REQUIRED"|"OWNER_REQUIRED"|"STORE_ACCESS_DENIED"|"PERMISSION_DENIED"|"TEAM_ACCESS_SUSPENDED"|"BUSINESS_NOT_FOUND", public readonly status = 403) { super(code); }
}

export type SellerPrincipal = {
  userId: string;
  businessId: string;
  ownerId: string;
  owner: boolean;
  membershipId: string | null;
  permissions: TeamPermission[];
  storeIds: string[];
};

export async function sellerPrincipal(db: Db, userId: string): Promise<SellerPrincipal | null> {
  return (await sellerPrincipals(db,userId))[0]??null;
}

export async function sellerPrincipals(db: Db, userId: string): Promise<SellerPrincipal[]> {
  const owned = await db.sellerBusiness.findUnique({ where: { ownerId: userId }, select: { id: true, ownerId: true, stores: { select: { id: true } } } });
  const memberships = await db.sellerTeamMembership.findMany({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, businessId: true, permissions: true, business: { select: { ownerId: true,owner:{select:{role:true}},billingStore:{select:{subscription:{select:{status:true,plan:true}},accessGrants:{select:{source:true,plan:true,startsAt:true,endsAt:true}}}} } }, assignments: { select: { storeId: true } } } });
  return [
    ...(owned ? [{ userId, businessId: owned.id, ownerId: owned.ownerId, owner: true, membershipId: null, permissions: [] as TeamPermission[], storeIds: owned.stores.map(store => store.id) }] : []),
    ...memberships.filter(membership=>hasProTeamEntitlement(membership.business)).map(membership => ({ userId, businessId: membership.businessId, ownerId: membership.business.ownerId, owner: false, membershipId: membership.id, permissions: membership.permissions, storeIds: membership.assignments.map(item => item.storeId) })),
  ];
}

export async function requireSellerPrincipal(db: Db, userId: string | null | undefined) {
  if (!userId) throw new SellerCapabilityError("AUTH_REQUIRED", 401);
  const principal = await sellerPrincipal(db, userId);
  if (!principal) throw new SellerCapabilityError("BUSINESS_NOT_FOUND", 403);
  return principal;
}

export async function requireBusinessOwner(db: Db, userId: string | null | undefined) {
  const principal = await requireSellerPrincipal(db, userId);
  if (!principal.owner) throw new SellerCapabilityError("OWNER_REQUIRED", 403);
  return principal;
}

export async function requireStoreCapability(db: Db, userId: string | null | undefined, storeId: string, permission: TeamPermission) {
  if (!userId) throw new SellerCapabilityError("AUTH_REQUIRED", 401);
  const store = await db.store.findUnique({ where: { id: storeId }, select: { businessId: true, ownerId: true } });
  if (!store) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  if (store.ownerId === userId) {
    if (!store.businessId) throw new SellerCapabilityError("BUSINESS_NOT_FOUND", 403);
    return { userId, businessId: store.businessId, ownerId: userId, owner: true, membershipId: null, permissions: [], storeIds: [storeId] } satisfies SellerPrincipal;
  }
  const membership = await db.sellerTeamMembership.findFirst({ where: { userId, businessId: store.businessId ?? undefined, status: "ACTIVE", assignments: { some: { storeId } } }, select: { id: true, businessId: true, permissions: true, business: { select: { ownerId: true,owner:{select:{role:true}},billingStore:{select:{subscription:{select:{status:true,plan:true}},accessGrants:{select:{source:true,plan:true,startsAt:true,endsAt:true}}}} } }, assignments: { select: { storeId: true } } } });
  if (!membership) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  if(!hasProTeamEntitlement(membership.business))throw new SellerCapabilityError("PERMISSION_DENIED",403);
  const principal = { userId, businessId: membership.businessId, ownerId: membership.business.ownerId, owner: false, membershipId: membership.id, permissions: membership.permissions, storeIds: membership.assignments.map(item => item.storeId) } satisfies SellerPrincipal;
  if (!principal.owner && !principal.permissions.includes(permission)) throw new SellerCapabilityError("PERMISSION_DENIED", 403);
  return principal;
}

export async function requireAnyStoreCapability(db: Db, userId: string | null | undefined, permission: TeamPermission) {
  const principal = await requireSellerPrincipal(db, userId);
  if (!principal.owner && !principal.permissions.includes(permission)) throw new SellerCapabilityError("PERMISSION_DENIED", 403);
  return principal;
}

export async function sellerStoreChoices(db: Db, userId: string | null | undefined) {
  if (!userId) throw new SellerCapabilityError("AUTH_REQUIRED", 401);
  const [owned,principals]=await Promise.all([db.store.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true, businessId: true } }),sellerPrincipals(db,userId)]);
  const assignedIds=principals.filter(principal=>!principal.owner).flatMap(principal=>principal.storeIds);
  const assigned=assignedIds.length?await db.store.findMany({where:{id:{in:assignedIds}},orderBy:{createdAt:"asc"},select:{id:true,name:true,slug:true,businessId:true}}):[];
  return [...new Map([...owned, ...assigned].map(store => [store.id, store])).values()];
}

export async function resolveSellerStoreContext(db: Db, userId: string | null | undefined, requestedStoreId?: string | null, permission?: TeamPermission) {
  const stores = await sellerStoreChoices(db, userId);
  if (!stores.length) throw new SellerCapabilityError("BUSINESS_NOT_FOUND", 403);
  const selected = requestedStoreId ? stores.find(store => store.id === requestedStoreId) : stores[0];
  if (!selected) throw new SellerCapabilityError("STORE_ACCESS_DENIED", 403);
  if (permission) await requireStoreCapability(db, userId, selected.id, permission);
  return { stores, selected };
}

export function sellerCapabilityResponse(error: unknown) {
  return error instanceof SellerCapabilityError ? { status: error.status, error: error.code } : { status: 500, error: "SELLER_ACCESS_FAILED" };
}
