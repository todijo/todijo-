CREATE TYPE "SupplierCatalogJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS');
CREATE TYPE "SupplierCatalogItemStatus" AS ENUM ('PENDING', 'IMPORTING', 'IMPORTED', 'SKIPPED', 'QUARANTINED', 'FAILED');

CREATE TABLE "SupplierCatalogImportJob" (
    "id" TEXT NOT NULL,
    "provider" "SupplierProvider" NOT NULL DEFAULT 'CJ',
    "status" "SupplierCatalogJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "destinationCountry" CHAR(2) NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "quarantinedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "batchLimit" INTEGER NOT NULL,
    "lastErrorCode" VARCHAR(100),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierCatalogImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierCatalogImportItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "requestedIdentifier" VARCHAR(200) NOT NULL,
    "canonicalSupplierId" VARCHAR(200),
    "supplierSku" VARCHAR(200),
    "status" "SupplierCatalogItemStatus" NOT NULL DEFAULT 'PENDING',
    "canonicalCategoryId" VARCHAR(160),
    "categoryMappingSource" VARCHAR(40),
    "categoryMappingReason" VARCHAR(500),
    "pricingStatus" VARCHAR(40),
    "pricingEvidence" JSONB,
    "stockStatus" VARCHAR(40),
    "complianceStatus" VARCHAR(40),
    "complianceReason" VARCHAR(500),
    "errorCode" VARCHAR(100),
    "errorMessage" VARCHAR(500),
    "productId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierCatalogImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierCatalogImportJob_createdById_createdAt_idx" ON "SupplierCatalogImportJob"("createdById", "createdAt");
CREATE INDEX "SupplierCatalogImportJob_status_updatedAt_idx" ON "SupplierCatalogImportJob"("status", "updatedAt");
CREATE UNIQUE INDEX "SupplierCatalogImportItem_jobId_requestedIdentifier_key" ON "SupplierCatalogImportItem"("jobId", "requestedIdentifier");
CREATE UNIQUE INDEX "SupplierCatalogImportItem_jobId_position_key" ON "SupplierCatalogImportItem"("jobId", "position");
CREATE INDEX "SupplierCatalogImportItem_jobId_status_position_idx" ON "SupplierCatalogImportItem"("jobId", "status", "position");
CREATE INDEX "SupplierCatalogImportItem_canonicalSupplierId_idx" ON "SupplierCatalogImportItem"("canonicalSupplierId");
CREATE INDEX "SupplierCatalogImportItem_productId_idx" ON "SupplierCatalogImportItem"("productId");

ALTER TABLE "SupplierCatalogImportJob" ADD CONSTRAINT "SupplierCatalogImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalogImportJob" ADD CONSTRAINT "SupplierCatalogImportJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalogImportItem" ADD CONSTRAINT "SupplierCatalogImportItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SupplierCatalogImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
