CREATE TYPE "CatalogDataClass" AS ENUM ('PRODUCTION', 'TEST_DEMO');

ALTER TABLE "Store"
ADD COLUMN "dataClass" "CatalogDataClass" NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE "Product"
ADD COLUMN "dataClass" "CatalogDataClass" NOT NULL DEFAULT 'PRODUCTION';

CREATE INDEX "Store_dataClass_status_idx" ON "Store"("dataClass", "status");
CREATE INDEX "Product_dataClass_status_removedAt_idx" ON "Product"("dataClass", "status", "removedAt");
