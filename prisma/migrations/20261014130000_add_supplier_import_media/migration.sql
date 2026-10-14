ALTER TABLE "ProductVariant"
ADD COLUMN "imageUrls" JSONB;

ALTER TABLE "SellerProductImportItem"
ADD COLUMN "warningCode" VARCHAR(100),
ADD COLUMN "warningDetails" JSONB;
