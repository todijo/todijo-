import type { Prisma } from "@prisma/client";
import { AdminAccessError, type ManagedStoreInput } from "./admin-access";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { lockSellerBusiness, sellerBusinessCommercialPlan } from "./seller-business";
import { lockManagedOwner, requireManagedOwner } from "./admin-store-owner-eligibility";

export async function createAdditionalAdminManagedStore(
  tx: Prisma.TransactionClient,
  adminId: string,
  input: ManagedStoreInput,
  businessId: string,
  now = new Date(),
) {
  await lockManagedOwner(tx, input.ownerId);
  const { owner, mode, businessId: eligibleBusinessId } = await requireManagedOwner(tx, input.ownerId, adminId, now);
  if (mode !== "ADDITIONAL" || eligibleBusinessId !== businessId) throw new AdminAccessError("Selected owner state changed.", 409, "OWNER_STATE_CHANGED");
  const locked = await lockSellerBusiness(tx, businessId);
  const storeCount = await tx.store.count({ where: { businessId } });
  if (storeCount >= locked.maxStores) throw new AdminAccessError("The Store limit has been reached.", 409, "STORE_LIMIT_REACHED");
  if (await sellerBusinessCommercialPlan(tx, businessId, now) !== "pro") throw new AdminAccessError("PRO access is required for an additional Store.", 403, "MULTI_STORE_PRO_REQUIRED");
  const store = await tx.store.create({
    data: {
      name: input.name, slug: input.slug, description: input.description || null,
      contactEmail: input.contactEmail, phone: input.phone || null, country: input.country,
      city: input.city, currency: input.currency, language: input.language,
      status: "ACTIVE", marketplaceActivatedAt: now, ownerId: owner.id, businessId,
    },
    select: { id: true, slug: true },
  });
  await appendSellerBusinessAudit(tx, { businessId, storeId: store.id, actorId: adminId, category: "STORE", action: "ADMIN_MANAGED_STORE_CREATED", targetType: "STORE", targetId: store.id, metadata: { ownerId: owner.id, source: "ADMIN_MANAGED_MULTI_STORE" } });
  return store;
}
