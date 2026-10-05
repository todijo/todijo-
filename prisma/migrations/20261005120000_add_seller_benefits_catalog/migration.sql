CREATE TYPE "SellerBenefitPriceType" AS ENUM ('FREE', 'SPECIAL');
CREATE TYPE "SellerBenefitRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELED');

CREATE TABLE "SellerBenefitAccess" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerBenefitAccess_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SellerBenefitCatalogItem" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1200) NOT NULL,
    "priceType" "SellerBenefitPriceType" NOT NULL,
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "quantityLimitPerStore" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerBenefitCatalogItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SellerBenefitRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "SellerBenefitRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "priceTypeSnapshot" "SellerBenefitPriceType" NOT NULL,
    "unitPriceMinorSnapshot" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerBenefitRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SellerBenefitAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "businessId" TEXT,
    "itemId" TEXT,
    "requestId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerBenefitAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerBenefitAccess_businessId_key" ON "SellerBenefitAccess"("businessId");
CREATE INDEX "SellerBenefitAccess_enabled_updatedAt_idx" ON "SellerBenefitAccess"("enabled", "updatedAt");
CREATE INDEX "SellerBenefitCatalogItem_active_availableFrom_availableUnti_idx" ON "SellerBenefitCatalogItem"("active", "availableFrom", "availableUntil");
CREATE UNIQUE INDEX "SellerBenefitRequest_businessId_storeId_idempotencyKey_key" ON "SellerBenefitRequest"("businessId", "storeId", "idempotencyKey");
CREATE INDEX "SellerBenefitRequest_businessId_storeId_itemId_status_idx" ON "SellerBenefitRequest"("businessId", "storeId", "itemId", "status");
CREATE INDEX "SellerBenefitRequest_status_createdAt_idx" ON "SellerBenefitRequest"("status", "createdAt");
CREATE INDEX "SellerBenefitAuditEvent_actorId_createdAt_idx" ON "SellerBenefitAuditEvent"("actorId", "createdAt");
CREATE INDEX "SellerBenefitAuditEvent_businessId_createdAt_idx" ON "SellerBenefitAuditEvent"("businessId", "createdAt");
CREATE INDEX "SellerBenefitAuditEvent_itemId_createdAt_idx" ON "SellerBenefitAuditEvent"("itemId", "createdAt");
CREATE INDEX "SellerBenefitAuditEvent_requestId_createdAt_idx" ON "SellerBenefitAuditEvent"("requestId", "createdAt");

ALTER TABLE "SellerBenefitAccess" ADD CONSTRAINT "SellerBenefitAccess_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitAccess" ADD CONSTRAINT "SellerBenefitAccess_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitCatalogItem" ADD CONSTRAINT "SellerBenefitCatalogItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitCatalogItem" ADD CONSTRAINT "SellerBenefitCatalogItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitRequest" ADD CONSTRAINT "SellerBenefitRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitRequest" ADD CONSTRAINT "SellerBenefitRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitRequest" ADD CONSTRAINT "SellerBenefitRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SellerBenefitCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitRequest" ADD CONSTRAINT "SellerBenefitRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitRequest" ADD CONSTRAINT "SellerBenefitRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitAuditEvent" ADD CONSTRAINT "SellerBenefitAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitAuditEvent" ADD CONSTRAINT "SellerBenefitAuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitAuditEvent" ADD CONSTRAINT "SellerBenefitAuditEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SellerBenefitCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerBenefitAuditEvent" ADD CONSTRAINT "SellerBenefitAuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SellerBenefitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
