import type { Prisma, PrismaClient, StoreAccessSource, UserRole } from "@prisma/client";

export const adminGrantMonths = [1, 3, 6, 12] as const;
export type AdminGrantMonths = (typeof adminGrantMonths)[number];
type Database = PrismaClient | Prisma.TransactionClient;

export class AdminAccessError extends Error {
  constructor(message: string, public status = 400, public code = "ADMIN_ACCESS_ERROR") {
    super(message);
  }
}

export function isAdminRole(role: UserRole | string | null | undefined) {
  return role === "ADMIN";
}

export async function requireAdmin(
  db: Database,
  session: { userId: string; role: UserRole | string } | null,
) {
  if (!session) throw new AdminAccessError("Authentication required.", 401, "AUTH_REQUIRED");
  if (!isAdminRole(session.role)) throw new AdminAccessError("Administrator access required.", 403, "ADMIN_REQUIRED");
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
  if (store.subscription && ["ACTIVE", "TRIALING"].includes(store.subscription.status)) {
    return { source: "STRIPE" as const, expiresAt: store.subscription.currentPeriodEnd ?? null };
  }
  const active = store.accessGrants
    .filter((grant) => grant.startsAt <= now && (
      (grant.source === "ADMIN_EXEMPT" && grant.endsAt === null)
      || (grant.source === "ADMIN_GRANTED" && grant.endsAt !== null && grant.endsAt > now)
    ))
    .sort((a, b) => (b.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];
  return active ? { source: active.source, expiresAt: active.endsAt } : { source: "NONE" as const, expiresAt: null };
}

export function publicStoreAccessWhere(now = new Date()): Prisma.StoreWhereInput {
  return {
    status: "ACTIVE",
    OR: [
      { subscription: { is: { status: { in: ["ACTIVE", "TRIALING"] } } } },
      { accessGrants: { some: { source: "ADMIN_EXEMPT", startsAt: { lte: now }, endsAt: null } } },
      { accessGrants: { some: { source: "ADMIN_GRANTED", startsAt: { lte: now }, endsAt: { gt: now } } } },
    ],
  };
}

export function publicProductAccessWhere(now = new Date()): Prisma.ProductWhereInput {
  return { store: publicStoreAccessWhere(now) };
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
};

export async function createManagedStore(db: Database, adminId: string, input: ManagedStoreInput, now = new Date()) {
  const owner = await db.user.findUnique({ where: { id: input.ownerId }, select: { id: true, role: true, store: { select: { id: true } } } });
  if (!owner) throw new AdminAccessError("Selected user was not found.", 404, "OWNER_NOT_FOUND");
  if (owner.store) throw new AdminAccessError("Selected user already owns a store.", 409, "STORE_EXISTS");
  const ownStore = owner.id === adminId;
  if (ownStore && owner.role !== "ADMIN") throw new AdminAccessError("Administrator store ownership is invalid.", 403, "ADMIN_REQUIRED");
  if (!ownStore && owner.role !== "SELLER") throw new AdminAccessError("Only an existing seller can receive a managed store.", 400, "OWNER_INELIGIBLE");
  if (!ownStore && !validGrantMonths(input.months)) throw new AdminAccessError("Select an initial access duration.", 400, "INVALID_DURATION");
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
      ownerId: owner.id,
      accessGrants: {
        create: {
          grantedById: adminId,
          source: ownStore ? "ADMIN_EXEMPT" : "ADMIN_GRANTED",
          startsAt: period?.startsAt ?? now,
          endsAt: period?.endsAt ?? null,
        },
      },
    },
    select: { id: true, slug: true },
  });
}

export async function extendManagedAccess(
  db: Database,
  adminId: string,
  storeIds: string[],
  months: AdminGrantMonths,
  now = new Date(),
) {
  if (!validGrantMonths(months)) throw new AdminAccessError("Duration must be 1, 3, 6, or 12 months.", 400, "INVALID_DURATION");
  const ids = [...new Set(storeIds.filter(Boolean))];
  if (!ids.length) throw new AdminAccessError("Select at least one store.", 400, "STORE_REQUIRED");
  const stores = await db.store.findMany({
    where: { id: { in: ids }, owner: { role: "SELLER" } },
    select: {
      id: true,
      accessGrants: { where: { source: "ADMIN_GRANTED" }, orderBy: { endsAt: "desc" }, take: 1, select: { endsAt: true } },
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });
  if (stores.length !== ids.length) throw new AdminAccessError("One or more selected stores are not eligible.", 400, "STORE_INELIGIBLE");
  const results = [];
  for (const store of stores) {
    const stripeEnd = store.subscription && ["ACTIVE", "TRIALING"].includes(store.subscription.status) ? store.subscription.currentPeriodEnd : null;
    const currentEnd = [store.accessGrants[0]?.endsAt, stripeEnd]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const period = calculateGrantPeriod(now, months, currentEnd);
    results.push(await db.storeAccessGrant.create({
      data: { storeId: store.id, grantedById: adminId, source: "ADMIN_GRANTED", ...period },
      select: { storeId: true, endsAt: true },
    }));
    await db.product.updateMany({
      where: { storeId: store.id, status: "DRAFT", deactivationReason: "SUBSCRIPTION_INACTIVE" },
      data: { status: "PUBLISHED", deactivationReason: "NONE" },
    });
  }
  return results;
}
