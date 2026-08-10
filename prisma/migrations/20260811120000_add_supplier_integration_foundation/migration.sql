CREATE TYPE "SupplierProvider" AS ENUM ('CJ');
CREATE TYPE "SupplierSyncStatus" AS ENUM ('HEALTHY', 'PRICE_CHANGED', 'UNAVAILABLE', 'ERROR');
CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "ProductMediaProvider" AS ENUM ('CLOUDINARY');

ALTER TABLE "ProductVariant"
ADD COLUMN "supplierProvider" "SupplierProvider",
ADD COLUMN "supplierVariantId" VARCHAR(200),
ADD COLUMN "supplierSku" VARCHAR(200),
ADD COLUMN "supplierCost" DECIMAL(12,2),
ADD COLUMN "supplierStock" INTEGER,
ADD COLUMN "supplierAvailable" BOOLEAN,
ADD COLUMN "supplierLastSyncedAt" TIMESTAMP(3);

CREATE TABLE "SupplierProductLink" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "provider" "SupplierProvider" NOT NULL,
  "supplierProductId" TEXT NOT NULL,
  "supplierSku" TEXT,
  "sourceUrl" TEXT,
  "supplierCost" DECIMAL(12,2),
  "previousSupplierCost" DECIMAL(12,2),
  "supplierCurrency" VARCHAR(3),
  "supplierStock" INTEGER,
  "supplierAvailable" BOOLEAN NOT NULL DEFAULT true,
  "syncStatus" "SupplierSyncStatus" NOT NULL DEFAULT 'HEALTHY',
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" VARCHAR(500),
  "sourceMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProductLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "ProductMediaType" NOT NULL,
  "provider" "ProductMediaProvider" NOT NULL,
  "publicId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "posterUrl" TEXT,
  "position" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_supplierProvider_supplierVariantId_key" ON "ProductVariant"("supplierProvider", "supplierVariantId");
CREATE UNIQUE INDEX "SupplierProductLink_productId_key" ON "SupplierProductLink"("productId");
CREATE UNIQUE INDEX "SupplierProductLink_provider_supplierProductId_key" ON "SupplierProductLink"("provider", "supplierProductId");
CREATE INDEX "SupplierProductLink_provider_syncStatus_lastSyncedAt_idx" ON "SupplierProductLink"("provider", "syncStatus", "lastSyncedAt");
CREATE UNIQUE INDEX "ProductMedia_productId_position_key" ON "ProductMedia"("productId", "position");
CREATE UNIQUE INDEX "ProductMedia_provider_publicId_key" ON "ProductMedia"("provider", "publicId");
CREATE INDEX "ProductMedia_productId_type_position_idx" ON "ProductMedia"("productId", "type", "position");

ALTER TABLE "SupplierProductLink" ADD CONSTRAINT "SupplierProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
