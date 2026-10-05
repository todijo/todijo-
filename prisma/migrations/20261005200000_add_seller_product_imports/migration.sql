ALTER TABLE "Product"
  ADD COLUMN "weightGrams" INTEGER,
  ADD COLUMN "lengthMm" INTEGER,
  ADD COLUMN "widthMm" INTEGER,
  ADD COLUMN "heightMm" INTEGER;

CREATE TABLE "SellerProductImportJob" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(80) NOT NULL,
  "sourceFormat" VARCHAR(8) NOT NULL,
  "mapping" JSONB NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PROCESSING',
  "requestedCount" INTEGER NOT NULL,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerProductImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerProductImportItem" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "sourceRow" JSONB NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "errorCode" VARCHAR(80),
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerProductImportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerProductImportJob_businessId_idempotencyKey_key" ON "SellerProductImportJob"("businessId", "idempotencyKey");
CREATE INDEX "SellerProductImportJob_storeId_createdAt_idx" ON "SellerProductImportJob"("storeId", "createdAt");
CREATE INDEX "SellerProductImportJob_status_updatedAt_idx" ON "SellerProductImportJob"("status", "updatedAt");
CREATE UNIQUE INDEX "SellerProductImportItem_productId_key" ON "SellerProductImportItem"("productId");
CREATE UNIQUE INDEX "SellerProductImportItem_importId_rowNumber_key" ON "SellerProductImportItem"("importId", "rowNumber");
CREATE INDEX "SellerProductImportItem_importId_status_idx" ON "SellerProductImportItem"("importId", "status");

ALTER TABLE "SellerProductImportJob" ADD CONSTRAINT "SellerProductImportJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerProductImportJob" ADD CONSTRAINT "SellerProductImportJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerProductImportJob" ADD CONSTRAINT "SellerProductImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerProductImportItem" ADD CONSTRAINT "SellerProductImportItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SellerProductImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerProductImportItem" ADD CONSTRAINT "SellerProductImportItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
