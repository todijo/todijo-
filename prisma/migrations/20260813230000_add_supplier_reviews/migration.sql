-- Supplier-origin reviews remain separate from verified Todijo buyer reviews.
ALTER TABLE "SupplierProductLink"
ADD COLUMN "reviewSyncStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
ADD COLUMN "reviewLastSyncedAt" TIMESTAMP(3),
ADD COLUMN "reviewSyncError" VARCHAR(500);

CREATE TABLE "SupplierReview" (
    "id" TEXT NOT NULL,
    "provider" "SupplierProvider" NOT NULL,
    "supplierReviewId" VARCHAR(200) NOT NULL,
    "supplierProductId" VARCHAR(200) NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierProductLinkId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000) NOT NULL,
    "supplierDisplayName" VARCHAR(200),
    "reviewedAt" TIMESTAMP(3),
    "countryCode" VARCHAR(2),
    "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceMetadata" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "SupplierReview_countryCode_check" CHECK ("countryCode" IS NULL OR "countryCode" ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX "SupplierReview_provider_supplierReviewId_key" ON "SupplierReview"("provider", "supplierReviewId");
CREATE INDEX "SupplierReview_productId_reviewedAt_idx" ON "SupplierReview"("productId", "reviewedAt");
CREATE INDEX "SupplierReview_supplierProductLinkId_reviewedAt_idx" ON "SupplierReview"("supplierProductLinkId", "reviewedAt");

ALTER TABLE "SupplierReview" ADD CONSTRAINT "SupplierReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierReview" ADD CONSTRAINT "SupplierReview_supplierProductLinkId_fkey" FOREIGN KEY ("supplierProductLinkId") REFERENCES "SupplierProductLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
