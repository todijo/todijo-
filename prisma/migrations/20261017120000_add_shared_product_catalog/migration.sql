CREATE TYPE "SharedCatalogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CatalogCorrectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "SharedCatalogProduct" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "brand" VARCHAR(160),
    "modelReference" VARCHAR(160),
    "brandModelKey" VARCHAR(400),
    "gtin" VARCHAR(32),
    "category" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mediaProvenance" JSONB NOT NULL DEFAULT '[]',
    "sourceLocale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "status" "SharedCatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SharedCatalogProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedCatalogVariant" (
    "id" TEXT NOT NULL,
    "sharedProductId" TEXT NOT NULL,
    "identityKey" VARCHAR(500) NOT NULL,
    "attributes" JSONB NOT NULL,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SharedCatalogVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedCatalogCorrection" (
    "id" TEXT NOT NULL,
    "sharedProductId" TEXT NOT NULL,
    "offerProductId" TEXT,
    "storeId" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "field" VARCHAR(80) NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "status" "CatalogCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedCatalogCorrection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedCatalogAdminEvent" (
    "id" TEXT NOT NULL,
    "sharedProductId" TEXT NOT NULL,
    "actorAdminId" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedCatalogAdminEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "sharedCatalogProductId" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "sharedCatalogVariantId" TEXT;

CREATE UNIQUE INDEX "SharedCatalogProduct_gtin_key" ON "SharedCatalogProduct"("gtin");
CREATE UNIQUE INDEX "SharedCatalogProduct_brandModelKey_key" ON "SharedCatalogProduct"("brandModelKey");
CREATE INDEX "SharedCatalogProduct_status_title_idx" ON "SharedCatalogProduct"("status", "title");
CREATE INDEX "SharedCatalogProduct_status_brand_modelReference_idx" ON "SharedCatalogProduct"("status", "brand", "modelReference");
CREATE UNIQUE INDEX "SharedCatalogVariant_sharedProductId_identityKey_key" ON "SharedCatalogVariant"("sharedProductId", "identityKey");
CREATE INDEX "SharedCatalogVariant_sharedProductId_idx" ON "SharedCatalogVariant"("sharedProductId");
CREATE INDEX "SharedCatalogCorrection_status_createdAt_idx" ON "SharedCatalogCorrection"("status", "createdAt");
CREATE INDEX "SharedCatalogCorrection_sharedProductId_createdAt_idx" ON "SharedCatalogCorrection"("sharedProductId", "createdAt");
CREATE INDEX "SharedCatalogAdminEvent_sharedProductId_createdAt_idx" ON "SharedCatalogAdminEvent"("sharedProductId", "createdAt");
CREATE INDEX "SharedCatalogAdminEvent_actorAdminId_createdAt_idx" ON "SharedCatalogAdminEvent"("actorAdminId", "createdAt");
CREATE INDEX "Product_sharedCatalogProductId_status_idx" ON "Product"("sharedCatalogProductId", "status");
CREATE INDEX "ProductVariant_sharedCatalogVariantId_idx" ON "ProductVariant"("sharedCatalogVariantId");

ALTER TABLE "SharedCatalogVariant" ADD CONSTRAINT "SharedCatalogVariant_sharedProductId_fkey" FOREIGN KEY ("sharedProductId") REFERENCES "SharedCatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogCorrection" ADD CONSTRAINT "SharedCatalogCorrection_sharedProductId_fkey" FOREIGN KEY ("sharedProductId") REFERENCES "SharedCatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogCorrection" ADD CONSTRAINT "SharedCatalogCorrection_offerProductId_fkey" FOREIGN KEY ("offerProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogCorrection" ADD CONSTRAINT "SharedCatalogCorrection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogCorrection" ADD CONSTRAINT "SharedCatalogCorrection_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogCorrection" ADD CONSTRAINT "SharedCatalogCorrection_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogAdminEvent" ADD CONSTRAINT "SharedCatalogAdminEvent_sharedProductId_fkey" FOREIGN KEY ("sharedProductId") REFERENCES "SharedCatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedCatalogAdminEvent" ADD CONSTRAINT "SharedCatalogAdminEvent_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sharedCatalogProductId_fkey" FOREIGN KEY ("sharedCatalogProductId") REFERENCES "SharedCatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sharedCatalogVariantId_fkey" FOREIGN KEY ("sharedCatalogVariantId") REFERENCES "SharedCatalogVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
