import "server-only";
import { Prisma, SellerSubscriptionChangeOperation, SellerSubscriptionChangeStatus, type PrismaClient } from "@prisma/client";
import { AdminAccessError, requireAdmin } from "./admin-access";
import { adminPage, normalizeAdminSearch } from "./admin-marketplace";
import { readManagedCommercialSummary } from "./admin-managed-plan";

export const adminChangeStatuses = Object.values(SellerSubscriptionChangeStatus);
export const adminChangeOperations = Object.values(SellerSubscriptionChangeOperation);
export type AdminChangeFilters = Partial<Record<"status" | "operation" | "store" | "seller" | "subscription" | "q" | "page", string>>;

export function adminSubscriptionChangeWhere(filters: AdminChangeFilters): Prisma.SellerSubscriptionChangeWhereInput {
  if (filters.status && !adminChangeStatuses.includes(filters.status as SellerSubscriptionChangeStatus)) throw new AdminAccessError("Invalid status.", 400, "INVALID_STATUS");
  if (filters.operation && !adminChangeOperations.includes(filters.operation as SellerSubscriptionChangeOperation)) throw new AdminAccessError("Invalid operation.", 400, "INVALID_OPERATION");
  const store = normalizeAdminSearch(filters.store), seller = normalizeAdminSearch(filters.seller), subscription = normalizeAdminSearch(filters.subscription), q = normalizeAdminSearch(filters.q);
  return {
    ...(filters.status ? { status: filters.status as SellerSubscriptionChangeStatus } : {}),
    ...(filters.operation ? { operation: filters.operation as SellerSubscriptionChangeOperation } : {}),
    sellerSubscription: {
      ...(subscription ? { id: subscription } : {}),
      store: { ...(store ? { id: store } : {}), ...(seller ? { ownerId: seller } : {}) },
    },
    ...(q ? { OR: [
      { id: q }, { stripeSubscriptionId: q }, { stripeInvoiceId: q }, { stripeScheduleId: q },
      { sellerSubscription: { store: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
      { sellerSubscription: { store: { owner: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } } },
      { sellerSubscription: { store: { owner: { firstName: { contains: q, mode: Prisma.QueryMode.insensitive } } } } },
      { sellerSubscription: { store: { owner: { lastName: { contains: q, mode: Prisma.QueryMode.insensitive } } } } },
    ] } : {}),
  };
}

/** No provider calls or writes. Requested targets never substitute for current entitlement. */
export async function inspectAdminSubscriptionChanges(db: PrismaClient, session: { userId: string; role?: string } | null, filters: AdminChangeFilters, now = new Date()) {
  await requireAdmin(db, session);
  const where = adminSubscriptionChangeWhere(filters);
  const total = await db.sellerSubscriptionChange.count({ where });
  const paging = adminPage(total, filters.page);
  const rows = await db.sellerSubscriptionChange.findMany({ where, skip: paging.skip, take: paging.take,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { sellerSubscription: { select: { id: true, plan: true, billingInterval: true, status: true, currentPeriodEnd: true, stripeSubscriptionId: true,
      store: { select: { id: true, name: true, businessId: true, owner: { select: { id: true, firstName: true, lastName: true, email: true } } } } } } },
  });
  const summaries = new Map(await Promise.all([...new Set(rows.map(row => row.sellerSubscription.store.id))].map(async id => [id, await readManagedCommercialSummary(db, id, now)] as const)));
  return { total, ...paging, rows: rows.map(row => {
    const summary = summaries.get(row.sellerSubscription.store.id)!;
    const source = summary.access.source === "STRIPE" ? "PAID_SUBSCRIPTION" as const
      : summary.access.source === "ADMIN_GRANTED" ? "ADMIN_GRANT" as const
      : summary.access.source === "ADMIN_EXEMPT" ? "ADMIN_EXEMPT" as const : "NONE" as const;
    return { ...row, commercial: { active: summary.access.active, source,
      plan: summary.access.plan === "admin-exempt" ? null : summary.access.plan,
      expiresAt: summary.access.expiresAt, error: summary.error },
      // The domain service has no Admin-authorized, stale-checked atomic audit boundary.
      // Do not expose a shortcut around it or invent a reason for unresolved state.
      actions: [] as string[], unresolved: row.status === "PREPARED",
    };
  }) };
}
