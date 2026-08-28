ALTER TABLE "Product" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedById" TEXT,
ADD COLUMN "removalActorRole" "UserRole";

CREATE INDEX "Product_removedAt_idx" ON "Product"("removedAt");
