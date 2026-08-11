-- Create the deterministic connection that owns all pre-isolation CJ mappings.
INSERT INTO "SupplierConnection" (
    "id", "provider", "ownerType", "storeId", "status", "connectedAt", "createdAt", "updatedAt"
) VALUES (
    'platform-cj', 'CJ', 'PLATFORM', NULL, 'CONNECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

-- Existing supplier links were deterministically classified as PLATFORM by the
-- preceding migration. Attach only those rows to the platform connection.
UPDATE "SupplierProductLink"
SET "connectionId" = 'platform-cj'
WHERE "ownerType" = 'PLATFORM' AND "connectionId" IS NULL;

-- Variants need their own direct connection identity for tenant-safe matching.
ALTER TABLE "ProductVariant" ADD COLUMN "supplierConnectionId" TEXT;

UPDATE "ProductVariant"
SET "supplierConnectionId" = 'platform-cj'
WHERE "supplierProvider" = 'CJ'
  AND "supplierVariantId" IS NOT NULL
  AND "supplierConnectionId" IS NULL;

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_supplierConnectionId_fkey"
FOREIGN KEY ("supplierConnectionId") REFERENCES "SupplierConnection"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace provider-global identities with connection-scoped identities.
DROP INDEX "SupplierProductLink_provider_supplierProductId_key";
DROP INDEX "ProductVariant_supplierProvider_supplierVariantId_key";

CREATE UNIQUE INDEX "SupplierProductLink_connectionId_supplierProductId_key"
ON "SupplierProductLink"("connectionId", "supplierProductId");

CREATE UNIQUE INDEX "ProductVariant_supplierConnectionId_supplierVariantId_key"
ON "ProductVariant"("supplierConnectionId", "supplierVariantId");

CREATE INDEX "ProductVariant_supplierConnectionId_productId_idx"
ON "ProductVariant"("supplierConnectionId", "productId");

-- During a rolling update, the previous platform-only application may briefly
-- create NULL-scoped mappings. Keep those legacy writes collision-safe without
-- treating NULL as a platform fallback for the new tenant-aware application.
CREATE UNIQUE INDEX "SupplierProductLink_legacy_null_scope_key"
ON "SupplierProductLink"("provider", "supplierProductId")
WHERE "connectionId" IS NULL;

CREATE UNIQUE INDEX "ProductVariant_legacy_null_scope_key"
ON "ProductVariant"("supplierProvider", "supplierVariantId")
WHERE "supplierConnectionId" IS NULL AND "supplierVariantId" IS NOT NULL;
