ALTER TABLE "SellerBusiness"
  ADD COLUMN "primaryStoreId" TEXT;

ALTER TABLE "Store"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT;

-- Keep the existing owner-designated primary when it is correctly attached to
-- this business. Otherwise use the valid billing store, then a deterministic
-- first business store. The existing billingStoreId and every Stripe reference
-- are deliberately left unchanged.
UPDATE "SellerBusiness" AS business
SET "primaryStoreId" = COALESCE(
  (
    SELECT store.id
    FROM "User" AS owner
    JOIN "Store" AS store ON store.id = owner."primaryStoreId"
    WHERE owner.id = business."ownerId"
      AND store."ownerId" = business."ownerId"
      AND store."businessId" = business.id
  ),
  (
    SELECT store.id
    FROM "Store" AS store
    WHERE store.id = business."billingStoreId"
      AND store."ownerId" = business."ownerId"
      AND store."businessId" = business.id
  ),
  (
    SELECT store.id
    FROM "Store" AS store
    WHERE store."ownerId" = business."ownerId"
      AND store."businessId" = business.id
    ORDER BY store."createdAt" ASC, store.id ASC
    LIMIT 1
  )
);

CREATE UNIQUE INDEX "SellerBusiness_primaryStoreId_key"
  ON "SellerBusiness"("primaryStoreId");

CREATE INDEX "Store_archivedAt_idx" ON "Store"("archivedAt");

ALTER TABLE "SellerBusiness"
  ADD CONSTRAINT "SellerBusiness_primaryStoreId_fkey"
  FOREIGN KEY ("primaryStoreId") REFERENCES "Store"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Store"
  ADD CONSTRAINT "Store_archivedById_fkey"
  FOREIGN KEY ("archivedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
