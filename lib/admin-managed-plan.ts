import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { requireAdmin } from "./admin-access";
import { AdminAccessError } from "./admin-access-error";
import { lockAdminGrant } from "./admin-grant-lock";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { isSellerPlanId } from "./seller-plans";
import { resolveSellerCommercialAccess } from "./seller-commercial-access";
import { ensureSellerBusiness } from "./seller-business";
import { lockManagedOwner } from "./admin-store-owner-eligibility";
import { enforceSellerPublicationCapacity } from "./seller-publication-capacity";
type Db = PrismaClient | Prisma.TransactionClient;
const select = {
  id: true, businessId: true, owner: { select: { id: true, role: true } },
  business: { select: { billingStoreId: true, ownerId: true } },
  subscription: { select: { status: true, plan: true, currentPeriodEnd: true } },
  accessGrants: { orderBy: { id: "asc" as const }, select: { id: true, source: true, plan: true, startsAt: true, endsAt: true } },
} as const;
export async function readManagedCommercialState(db: Db, storeId: string, now = new Date()) {
  const requested = await db.store.findUnique({ where: { id: storeId }, select });
  if (!requested) throw new AdminAccessError("Store not found.", 404, "STORE_NOT_FOUND");
  if (requested.business && requested.business.ownerId !== requested.owner.id) throw new AdminAccessError("Business owner mismatch.", 409, "OWNER_STATE_CHANGED");
  if (requested.business && !requested.business.billingStoreId) throw new AdminAccessError("Business billing store is unavailable.", 409, "BILLING_STORE_REQUIRED");
  const targetId = requested.business?.billingStoreId ?? requested.id;
  const target = targetId === requested.id ? requested : await db.store.findUnique({ where: { id: targetId }, select });
  if (!target || target.businessId !== requested.businessId || target.owner.id !== requested.owner.id) throw new AdminAccessError("Business billing store changed.", 409, "TARGET_CHANGED");
  const access = resolveSellerCommercialAccess({ role: target.owner.role, subscription: target.subscription, accessGrants: target.accessGrants }, now);
  // Include the durable audit revision so FREE → PRO → FREE cannot revive an old UI token.
  const revision = target.businessId ? await db.sellerBusinessAuditEvent.count({ where: { businessId: target.businessId, storeId: target.id, action: "ADMIN_GRANT_PLAN_CHANGED" } }) : 0;
  const version = createHash("sha256").update(JSON.stringify({ revision, targetId, businessId: target.businessId, business: target.business, owner: target.owner, subscription: target.subscription, grants: target.accessGrants })).digest("hex");
  return { target, access, version };
}
/** A malformed legacy identity must not crash the entire Admin directory. Mutations still fail closed. */
export async function readManagedCommercialSummary(db: Db, storeId: string, now = new Date()) {
  try { return { ...await readManagedCommercialState(db, storeId, now), error: null }; }
  catch (error) {
    if (!(error instanceof AdminAccessError)) throw error;
    return { target: null, access: { active: false, plan: null, source: "NONE" as const, expiresAt: null }, version: null, error: error.code };
  }
}
export async function changeManagedGrantPlan(db: PrismaClient, session: { userId: string } | null, input: { storeId: string; plan: unknown; version: unknown; reason?: string }, now = new Date()) {
  if (!isSellerPlanId(input.plan)) throw new AdminAccessError("Invalid plan.", 400, "INVALID_SELLER_PLAN");
  const plan = input.plan;
  if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 500)) throw new AdminAccessError("Invalid reason.", 400, "INVALID_REASON");
  return db.$transaction(async tx => {
    const admin = await requireAdmin(tx, session);
    const initial = await readManagedCommercialState(tx, input.storeId, now);
    await lockManagedOwner(tx, initial.target.owner.id);
    await lockAdminGrant(tx, initial.target.id);
    const state = await readManagedCommercialState(tx, input.storeId, now);
    if (state.target.owner.role !== "SELLER") throw new AdminAccessError("Seller ownership required.", 409, "OWNER_STATE_CHANGED");
    if (state.target.id !== initial.target.id || typeof input.version !== "string" || state.version !== input.version) throw new AdminAccessError("Refresh before changing this grant.", 409, "GRANT_STATE_CHANGED");
    if (state.access.source !== "ADMIN_GRANTED") throw new AdminAccessError("Only active Admin grants can change tier. Paid subscriptions remain authoritative.", 409, "ADMIN_GRANT_REQUIRED");
    const active = state.target.accessGrants.filter(grant => grant.source === "ADMIN_GRANTED" && grant.startsAt <= now && grant.endsAt !== null && grant.endsAt > now);
    if (active.length !== 1) throw new AdminAccessError("Overlapping grants require separate review.", 409, "AMBIGUOUS_ACTIVE_GRANTS");
    let businessId = state.target.businessId;
    if (!businessId) {
      const owner = await tx.user.findUnique({ where: { id: state.target.owner.id }, select: { id: true, role: true, primaryStoreId: true, ownedBusiness: { select: { id: true, billingStoreId: true, _count: { select: { stores: true } } } } } });
      if (!owner || owner.role !== "SELLER" || owner.id !== state.target.owner.id) throw new AdminAccessError("Owner changed.", 409, "OWNER_STATE_CHANGED");
      if (owner.primaryStoreId && owner.primaryStoreId !== state.target.id || owner.ownedBusiness?.billingStoreId && owner.ownedBusiness.billingStoreId !== state.target.id || owner.ownedBusiness && !owner.ownedBusiness.billingStoreId && owner.ownedBusiness._count.stores > 0) throw new AdminAccessError("Existing primary/billing identity conflicts.", 409, "BUSINESS_IDENTITY_CONFLICT");
      await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id"=${state.target.id} AND "ownerId"=${owner.id} FOR UPDATE`;
      const linked = await ensureSellerBusiness(tx, owner.id, state.target.id);
      const verified = await tx.store.findUnique({ where: { id: state.target.id }, select: { ownerId: true, businessId: true } });
      if (verified?.ownerId !== owner.id || verified.businessId !== linked.id) throw new AdminAccessError("Store identity changed.", 409, "TARGET_CHANGED");
      businessId = linked.id;
      await appendSellerBusinessAudit(tx, { businessId, storeId: state.target.id, actorId: admin.id, category: "ENTITLEMENT", action: "ADMIN_MANAGED_BUSINESS_LINKED", targetType: "STORE", targetId: state.target.id, metadata: { previousBusinessId: null, previousPrimaryStoreId: owner.primaryStoreId, previousBillingStoreId: owner.ownedBusiness?.billingStoreId ?? null } });
    }
    const affected = state.target.accessGrants.filter(grant => grant.source === "ADMIN_GRANTED" && grant.endsAt !== null && grant.endsAt > now);
    const previous = affected.map(grant => ({ id: grant.id, plan: grant.plan, startsAt: grant.startsAt.toISOString(), endsAt: grant.endsAt!.toISOString() }));
    for (const grant of affected) {
      const changed = await tx.storeAccessGrant.updateMany({ where: { id: grant.id, storeId: state.target.id, source: "ADMIN_GRANTED", plan: grant.plan, startsAt: grant.startsAt, endsAt: grant.endsAt }, data: { plan } });
      if (changed.count !== 1) throw new AdminAccessError("Grant changed concurrently.", 409, "GRANT_STATE_CHANGED");
    }
    await appendSellerBusinessAudit(tx, { businessId, storeId: state.target.id, actorId: admin.id, category: "ENTITLEMENT", action: "ADMIN_GRANT_PLAN_CHANGED", targetType: "STORE_ACCESS_GRANT", targetId: active[0].id, metadata: { previousEffectiveTier: state.access.plan, previous, plan, reason: input.reason?.trim().slice(0,500) ?? "", expiryPreserved: true, futureTiersAligned: true } });
    if (plan !== "pro") await enforceSellerPublicationCapacity(tx, state.target.id, businessId, now);
    return { plan, expiresAt: active[0].endsAt!.toISOString() };
  }, { isolationLevel: "Serializable" });
}
