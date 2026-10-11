ALTER TABLE "Store" ADD COLUMN "slugLastChangedAt" TIMESTAMP(3);

CREATE TABLE "StoreSlugHistory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreSlugHistory_slug_key" ON "StoreSlugHistory"("slug");
CREATE INDEX "StoreSlugHistory_storeId_createdAt_idx" ON "StoreSlugHistory"("storeId", "createdAt");

ALTER TABLE "StoreSlugHistory"
    ADD CONSTRAINT "StoreSlugHistory_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
