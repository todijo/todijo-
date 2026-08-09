CREATE TYPE "SellerVatStatus" AS ENUM ('UNKNOWN', 'REGISTERED', 'NOT_REGISTERED_OR_NOT_APPLICABLE');
CREATE TYPE "ProductReportReason" AS ENUM ('ILLEGAL', 'UNSAFE', 'MISLEADING', 'PROHIBITED', 'OTHER');
CREATE TYPE "ProductReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

ALTER TABLE "Store" ADD COLUMN "vatStatus" "SellerVatStatus" NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "Order"
  ADD COLUMN "sellerVatStatusSnapshot" "SellerVatStatus",
  ADD COLUMN "sellerInvoiceReference" TEXT,
  ADD COLUMN "sellerInvoiceUrl" TEXT,
  ADD COLUMN "sellerInvoiceIssuedAt" TIMESTAMP(3);

ALTER TABLE "Product"
  ADD COLUMN "productIdentifier" TEXT,
  ADD COLUMN "manufacturerName" TEXT,
  ADD COLUMN "manufacturerContact" TEXT,
  ADD COLUMN "responsiblePerson" TEXT,
  ADD COLUMN "safetyInformation" TEXT,
  ADD COLUMN "complianceInformation" TEXT,
  ADD COLUMN "complianceDeclaredAt" TIMESTAMP(3);

CREATE TABLE "ProductReport" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "ProductReportReason" NOT NULL,
  "details" VARCHAR(1500) NOT NULL,
  "status" "ProductReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductReport_productId_reporterId_key" ON "ProductReport"("productId", "reporterId");
CREATE INDEX "ProductReport_status_createdAt_idx" ON "ProductReport"("status", "createdAt");
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
