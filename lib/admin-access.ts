import type { Prisma, PrismaClient, StoreAccessSource, UserRole } from "@prisma/client";
import { isSellerPlanId, type SellerPlanId } from "./seller-plans";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { AdminAccessError } from "./admin-access-error";
import { lockManagedOwner, requireManagedOwner } from "./admin-store-owner-eligibility";
export { AdminAccessError } from "./admin-access-error";

export const adminGrantMonths = [1, 3, 6, 12] as const;
export type AdminGrantMonths = (typeof adminGrantMonths)[number];
type Database = PrismaClient | Prisma.TransactionClient;


export function isAdminRole(role: UserRole | string | null | undefined) {
  return role === "ADMIN";
}

export async function requireAdmin(
  db: Database,
  session: { userId: string; role?: UserRole | string } | null,
) {
  if (!session) throw new AdminAccessError("Authentication required.", 401, "AUTH_REQUIRED");
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!user || !isAdminRole(user.role)) throw new AdminAccessError("Administrator access required.", 403, "ADMIN_REQUIRED");
  return user;
}

export function validGrantMonths(value: unknown): value is AdminGrantMonths {
  return typeof value === "number" && adminGrantMonths.includes(value as AdminGrantMonths);
}

export function addCalendarMonths(date: Date, months: AdminGrantMonths) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function calculateGrantPeriod(now: Date, months: AdminGrantMonths, currentEnd?: Date | null) {
  if (!validGrantMonths(months)) throw new AdminAccessError("Duration must be 1, 3, 6, or 12 months.", 400, "INVALID_DURATION");
  const startsAt = currentEnd && currentEnd > now ? currentEnd : now;
  return { startsAt, endsAt: addCalendarMonths(startsAt, months) };
}

export function activeAccessSource(store: {
  subscription: { status: string; currentPeriodEnd?: Date | null } | null;
  accessGrants: Array<{ source: StoreAccessSource; startsAt: Date; endsAt: Date | null }>;
}, now = new Date()) {
  const active = store.accessGrants
    .filter((grant) => grant.startsAt <= now && (
      (grant.source === "ADMIN_EXEMPT" && grant.endsAt === null)
      || (grant.source === "ADMIN_GRANTED" && grant.endsAt !== null && grant.endsAt > now)
    ))
    .sort((a, b) => (b.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
  if (active?.source === "ADMIN_EXEMPT") return { source: active.source, expiresAt: null };
  if (store.subscription && ["ACTIVE", "TRIALING"].includes(store.subscription.status) && store.subscription.currentPeriodEnd && store.subscription.currentPeriodEnd > now) {
    return { source: "STRIPE" as const, expiresAt: store.subscription.currentPeriodEnd ?? null };
  }
  return active ? { source: active.source, expiresAt: active.endsAt } : { source: "NONE" as const, expiresAt: null };
}

export function publicStoreAccessWhere(now = new Date()): Prisma.StoreWhereInput {
  return {
    dataClass: "PRODUCTION",
    status: "ACTIVE",
    owner: { sellerSuspendedAt: null, deactivatedAt: null },
    OR: [
      { subscription: { is: { status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: now } } } },
      { accessGrants: { some: { source: "ADMIN_EXEMPT", startsAt: { lte: now }, endsAt: null } } },
      { accessGrants: { some: { source: "ADMIN_GRANTED", startsAt: { lte: now }, endsAt: { gt: now } } } },
      { business: { is: { billingStore: { is: { OR: [
        { subscription: { is: { status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: now } } } },
        { accessGrants: { some: { source: "ADMIN_EXEMPT", startsAt: { lte: now }, endsAt: null } } },
        { accessGrants: { some: { source: "ADMIN_GRANTED", startsAt: { lte: now }, endsAt: { gt: now } } } },
      ] } } } } },
    ],
  };
}

export function publicProductAccessWhere(now = new Date()): Prisma.ProductWhereInput {
  return {
    dataClass: "PRODUCTION",
    removedAt: null,
    store: publicStoreAccessWhere(now),
    OR: [
      { supplierLink: { is: null } },
      { supplierLink: { is: { supplierAvailable: true, syncStatus: "HEALTHY" } } },
    ],
  };
}

export type ManagedStoreInput = {
  ownerId: string;
  name: string;
  slug: string;
  description?: string | null;
  contactEmail: string;
  phone?: string | null;
  country: string;
  city: string;
  currency: string;
  language: string;
  months?: AdminGrantMonths;
  plan?: SellerPlanId;
};

export async function createManagedStore(db: Database, adminId: string, input: ManagedStoreInput, now = new Date()): Promise<{ id: string; slug: string }> {
  if ("$transaction" in db) return db.$transaction(tx => createManagedStore(tx, adminId, input, now), { isolationLevel: "Serializable" });
  await lockManagedOwner(db, input.ownerId);
  const { owner, mode } = await requireManagedOwner(db, input.ownerId, adminId, now);
  if (mode !== "FIRST") throw new AdminAccessError("Selected owner requires the additional-store flow.", 409, "OWNER_STATE_CHANGED");
  const ownStore = owner.id === adminId;
  if (ownStore && owner.role !== "ADMIN") throw new AdminAccessError("Administrator store ownership is invalid.", 403, "ADMIN_REQUIRED");
  if (!ownStore && owner.role !== "SELLER") throw new AdminAccessError("Only an existing seller can receive a managed store.", 400, "OWNER_INELIGIBLE");
  if (!ownStore && !validGrantMonths(input.months)) throw new AdminAccessError("Select an initial access duration.", 400, "INVALID_DURATION");
  if (!ownStore && !isSellerPlanId(input.plan)) throw new AdminAccessError("Select a valid seller plan.", 400, "INVALID_SELLER_PLAN");
  const period = ownStore ? null : calculateGrantPeriod(now, input.months!);
  return db.store.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      contactEmail: input.contactEmail,
      phone: input.phone || null,
      country: input.country,
      city: input.city,
      currency: input.currency,
      language: input.language,
      status: "ACTIVE",
      marketplaceActivatedAt: now,
      ownerId: owner.id,
      accessGrants: {
        create: {
          grantedById: adminId,
          source: ownStore ? "ADMIN_EXEMPT" : "ADMIN_GRANTED",
          plan: ownStore ? null : input.plan,
          startsAt: period?.startsAt ?? now,
          endsAt: period?.endsAt ?? null,
        },
      },
    },
    select: { id: true, slug: true },
  });
}

export async function exemptExistingAdminStore(db: Database, adminId: string, now = new Date()) {
  const store = await db.store.findFirst({
    where: { ownerId: adminId },
    select: {
      id: true,
      owner: { select: { role: true } },
      accessGrants: { where: { source: "ADMIN_EXEMPT" }, take: 1, select: { id: true, endsAt: true } },
    },
  });
  if (!store) throw new AdminAccessError("Create your store first.", 404, "STORE_REQUIRED");
  if (store.owner.role !== "ADMIN") throw new AdminAccessError("Administrator store ownership is invalid.", 403, "ADMIN_REQUIRED");
  const existing = store.accessGrants[0];
  if (existing) {
    if (existing.endsAt !== null) {
      await db.storeAccessGrant.update({ where: { id: existing.id }, data: { endsAt: null } });
    }
    return { storeId: store.id, created: false };
  }
  await db.storeAccessGrant.create({
    data: { storeId: store.id, grantedById: adminId, source: "ADMIN_EXEMPT", startsAt: now, endsAt: null },
  });
  return { storeId: store.id, created: true };
}

export async function extendManagedAccess(
  db: Database,
  adminId: string,
  storeIds: string[],
  months: AdminGrantMonths,
  now = new Date(),
  plan?: SellerPlanId,
) {
  if (!validGrantMonths(months)) throw new AdminAccessError("Duration must be 1, 3, 6, or 12 months.", 400, "INVALID_DURATION");
  if (!isSellerPlanId(plan)) throw new AdminAccessError("Select a valid seller plan.", 400, "INVALID_SELLER_PLAN");
  const ids = [...new Set(storeIds.filter(Boolean))];
  if (!ids.length) throw new AdminAccessError("Select at least one store.", 400, "STORE_REQUIRED");
  const stores = await db.store.findMany({
    where: { id: { in: ids }, owner: { role: "SELLER" } },
    select: {
      id: true,
      accessGrants: { where: { source: "ADMIN_GRANTED" }, orderBy: { endsAt: "desc" }, take: 1, select: { endsAt: true } },
      subscription: { select: { status: true, currentPeriodEnd: true } },
      business: { select: { id:true,billingStoreId:true,billingStore:{select:{accessGrants:{where:{source:"ADMIN_GRANTED"},orderBy:{endsAt:"desc"},take:1,select:{endsAt:true}},subscription:{select:{status:true,currentPeriodEnd:true}}}} } },
    },
  });
  if (stores.length !== ids.length) throw new AdminAccessError("One or more selected stores are not eligible.", 400, "STORE_INELIGIBLE");
  const results = [];
  const targets=new Map(stores.map(store=>[store.business?.billingStoreId??store.id,{storeId:store.business?.billingStoreId??store.id,businessId:store.business?.id??null,accessGrants:store.business?.billingStore?.accessGrants??store.accessGrants,subscription:store.business?.billingStore?.subscription??store.subscription}]));
  for (const target of targets.values()) {
    const stripeEnd = target.subscription && ["ACTIVE", "TRIALING"].includes(target.subscription.status) && target.subscription.currentPeriodEnd && target.subscription.currentPeriodEnd > now ? target.subscription.currentPeriodEnd : null;
    const currentEnd = [target.accessGrants[0]?.endsAt, stripeEnd]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const period = calculateGrantPeriod(now, months, currentEnd);
    results.push(await db.storeAccessGrant.create({
      data: { storeId: target.storeId, grantedById: adminId, source: "ADMIN_GRANTED", plan, ...period },
      select: { storeId: true, endsAt: true },
    }));
    await db.product.updateMany({
      where: { ...(target.businessId?{store:{businessId:target.businessId}}:{storeId:target.storeId}), removedAt:null, status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" },
      data: { status: "PUBLISHED", deactivationReason: "NONE" },
    });
    if(target.businessId)await appendSellerBusinessAudit(db,{businessId:target.businessId,storeId:target.storeId,actorId:adminId,category:"ENTITLEMENT",action:"ADMIN_GRANT_CREATED",targetType:"STORE_ACCESS_GRANT",targetId:target.storeId,metadata:{plan,startsAt:period.startsAt.toISOString(),endsAt:period.endsAt.toISOString()}});
  }
  return results;
}
