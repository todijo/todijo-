CREATE TYPE "SellerVerificationDocumentType" AS ENUM (
  'BUSINESS_REGISTRATION',
  'REPRESENTATION_AUTHORITY',
  'OTHER'
);

CREATE TYPE "SellerVerificationDocumentStatus" AS ENUM (
  'SUBMITTED',
  'ACCEPTED',
  'NEEDS_INFORMATION',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TABLE "SellerVerificationDocument" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "storeId" TEXT,
  "uploadedById" TEXT,
  "reviewedById" TEXT,
  "type" "SellerVerificationDocumentType" NOT NULL,
  "status" "SellerVerificationDocumentStatus" NOT NULL DEFAULT 'SUBMITTED',
  "businessSiren" VARCHAR(9),
  "storageKey" TEXT NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "reviewReason" VARCHAR(1000),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerVerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerVerificationDocument_storageKey_key" ON "SellerVerificationDocument"("storageKey");
CREATE UNIQUE INDEX "SellerVerificationDocument_businessId_type_businessSiren_contentHash_key" ON "SellerVerificationDocument"("businessId", "type", "businessSiren", "contentHash");
CREATE INDEX "SellerVerificationDocument_businessId_storeId_status_submittedAt_idx" ON "SellerVerificationDocument"("businessId", "storeId", "status", "submittedAt");
CREATE INDEX "SellerVerificationDocument_storeId_type_submittedAt_idx" ON "SellerVerificationDocument"("storeId", "type", "submittedAt");
CREATE INDEX "SellerVerificationDocument_uploadedById_submittedAt_idx" ON "SellerVerificationDocument"("uploadedById", "submittedAt");

ALTER TABLE "SellerVerificationDocument"
  ADD CONSTRAINT "SellerVerificationDocument_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SellerVerificationDocument_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SellerVerificationDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SellerVerificationDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
