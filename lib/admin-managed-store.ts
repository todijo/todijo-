import type { Prisma } from "@prisma/client";
import { AdminAccessError, extendManagedAccess, type ManagedStoreInput, validGrantMonths } from "./admin-access";
import { isSellerPlanId } from "./seller-plans";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { lockSellerBusiness } from "./seller-business";
import { lockManagedOwner, requireManagedOwner } from "./admin-store-owner-eligibility";

export async function createAdditionalAdminManagedStore(
  tx: Prisma.TransactionClient,
  adminId: string,
  input: ManagedStoreInput,
  businessId: string | null,
  now = new Date(),
) {
  await lockManagedOwner(tx, input.ownerId);
  const { owner, mode, businessId: eligibleBusinessId } = await requireManagedOwner(tx, input.ownerId, adminId, now);
  if (owner.id === adminId && owner.role === "ADMIN" && mode === "ADDITIONAL" && !businessId && !eligibleBusinessId) {
    return tx.store.create({
      data: {
        name: input.name, slug: input.slug, description: input.description || null,
        contactEmail: input.contactEmail, phone: input.phone || null, country: input.country,
        city: input.city, currency: input.currency, language: input.language,
        status: "ACTIVE", marketplaceActivatedAt: now, ownerId: owner.id,
        accessGrants: { create: { grantedById: adminId, source: "ADMIN_EXEMPT", plan: null, startsAt: now, endsAt: null } },
      },
      select: { id: true, slug: true },
    });
  }
  if (mode !== "ADDITIONAL" || !businessId || eligibleBusinessId !== businessId) throw new AdminAccessError("Selected owner state changed.", 409, "OWNER_STATE_CHANGED");
  const locked = await lockSellerBusiness(tx, businessId);
  if (!locked.billingStoreId) throw new AdminAccessError("Seller business billing identity is incomplete.", 409, "OWNER_BUSINESS_INCONSISTENT");
  if (!validGrantMonths(input.months) || !isSellerPlanId(input.plan)) throw new AdminAccessError("Select a valid initial access grant.", 400, "INVALID_INITIAL_ACCESS");
  const store = await tx.store.create({
    data: {
      name: input.name, slug: input.slug, description: input.description || null,
      contactEmail: input.contactEmail, phone: input.phone || null, country: input.country,
      city: input.city, currency: input.currency, language: input.language,
      status: "ACTIVE", marketplaceActivatedAt: now, ownerId: owner.id, businessId,
    },
    select: { id: true, slug: true },
  });
  await extendManagedAccess(tx, adminId, [store.id], input.months, now, input.plan);
  await appendSellerBusinessAudit(tx, { businessId, storeId: store.id, actorId: adminId, category: "STORE", action: "ADMIN_MANAGED_STORE_CREATED", targetType: "STORE", targetId: store.id, metadata: { ownerId: owner.id, source: "ADMIN_MANAGED_MULTI_STORE" } });
  return store;
}
