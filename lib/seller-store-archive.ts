import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { lockSellerBusiness, SellerBusinessError } from "./seller-business";

/**
 * Deactivates one subordinate store and transfers its current
 * catalog rows to the canonical primary store. Product/variant IDs are kept,
 * so order, refund, shipment, review, and financial history keeps its original
 * references and snapshots. No Stripe, subscription, or supplier records move.
 */
export async function archiveSubordinateStore(db: PrismaClient, input: { ownerId: string; storeId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const business = await tx.sellerBusiness.findUnique({ where: { ownerId: input.ownerId }, select: { id: true, primaryStoreId: true } });
    if (!business) throw new SellerBusinessError("BUSINESS_NOT_FOUND", 404);
    await lockSellerBusiness(tx, business.id);

    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Store" WHERE "businessId"=${business.id} AND "id" IN (${Prisma.join([input.storeId, business.primaryStoreId ?? ""])}) FOR UPDATE`);
    const locked = new Set(rows.map((row) => row.id));
    if (!business.primaryStoreId || !locked.has(business.primaryStoreId)) throw new SellerBusinessError("BUSINESS_PRIMARY_STORE_NOT_FOUND", 409);
    if (!locked.has(input.storeId)) throw new SellerBusinessError("STORE_NOT_OWNED_BY_BUSINESS", 404);
    if (input.storeId === business.primaryStoreId) throw new SellerBusinessError("PRIMARY_STORE_CANNOT_BE_ARCHIVED", 409);

    const source = await tx.store.findUnique({ where: { id: input.storeId }, select: { id: true, ownerId: true, businessId: true, archivedAt: true, status: true } });
    if (!source || source.ownerId !== input.ownerId || source.businessId !== business.id) throw new SellerBusinessError("STORE_NOT_OWNED_BY_BUSINESS", 404);
    if (source.archivedAt) return { archived: false, alreadyArchived: true, movedProducts: 0 };

    const collision = await tx.$queryRaw<Array<{ collides: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "Product" AS source_product
        JOIN "Product" AS primary_product
          ON primary_product."storeId"=${business.primaryStoreId}
         AND primary_product."slug"=source_product."slug"
        WHERE source_product."storeId"=${source.id}
      ) AS "collides"
    `);
    if (collision[0]?.collides) throw new SellerBusinessError("STORE_PRODUCT_SLUG_CONFLICT", 409);

    // Flatten inherited shipping onto each moved product before its Store
    // relation changes. Explicit product-level shipping is left untouched.
    const moved = await tx.$executeRaw(Prisma.sql`
      UPDATE "Product" AS product
      SET "storeId"=${business.primaryStoreId},
          "status"=CASE WHEN product."status"='PUBLISHED' THEN 'DRAFT'::"ProductStatus" ELSE product."status" END,
          "deactivationReason"=CASE WHEN product."status"='PUBLISHED' THEN 'SELLER'::"ProductDeactivationReason" ELSE product."deactivationReason" END,
          "shippingEnabled"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingEnabled" ELSE source."shippingEnabled" END,
          "shippingMethodName"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingMethodName" ELSE source."shippingMethodName" END,
          "shippingPrice"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingPrice" ELSE source."shippingPrice" END,
          "shippingFree"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingFree" ELSE source."shippingFree" END,
          "shippingFreeThreshold"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingFreeThreshold" ELSE source."shippingFreeThreshold" END,
          "shippingMinDays"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingMinDays" ELSE source."shippingMinDays" END,
          "shippingMaxDays"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingMaxDays" ELSE source."shippingMaxDays" END,
          "shippingCountries"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingCountries" ELSE source."shippingCountries" END,
          "shippingWorldwide"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingWorldwide" ELSE source."shippingWorldwide" END,
          "shippingPostalCodes"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingPostalCodes" ELSE source."shippingPostalCodes" END,
          "shippingCarrier"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingCarrier" ELSE source."shippingCarrier" END,
          "shippingProvider"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingProvider" ELSE source."shippingProvider" END,
          "shippingExternalServiceId"=CASE WHEN product."shippingOverrideEnabled" THEN product."shippingExternalServiceId" ELSE source."shippingExternalServiceId" END,
          "shippingOverrideEnabled"=true,
          "updatedAt"=${now}
      FROM "Store" AS source
      WHERE product."storeId"=source."id" AND source."id"=${source.id}
    `);

    // Remove only store-scoped delegation. Memberships and invitations for
    // other stores remain intact; the archived Store and its audit history live on.
    await tx.sellerTeamStoreAssignment.deleteMany({ where: { storeId: source.id } });
    await tx.sellerTeamInvitationStore.deleteMany({ where: { storeId: source.id } });
    const changed = await tx.store.updateMany({
      where: { id: source.id, ownerId: input.ownerId, businessId: business.id, archivedAt: null },
      data: { archivedAt: now, archivedById: input.ownerId, status: "SUSPENDED" },
    });
    if (changed.count !== 1) throw new SellerBusinessError("STORE_ARCHIVE_CONFLICT", 409);

    await appendSellerBusinessAudit(tx, {
      businessId: business.id,
      storeId: source.id,
      actorId: input.ownerId,
      category: "STORE",
      action: "SUBORDINATE_STORE_ARCHIVED",
      targetType: "STORE",
      targetId: source.id,
      metadata: { primaryStoreId: business.primaryStoreId, movedProductCount: moved, previousStatus: source.status, archivedAt: now.toISOString() },
    });
    return { archived: true, alreadyArchived: false, movedProducts: moved };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
