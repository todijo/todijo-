ALTER TABLE "Product"
ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP INDEX "SellerProductImportItem_productId_key";

CREATE INDEX "SellerProductImportItem_productId_idx"
ON "SellerProductImportItem"("productId");
