-- CreateEnum
CREATE TYPE "StoreAccessSource" AS ENUM ('ADMIN_GRANTED', 'ADMIN_EXEMPT');

-- CreateTable
CREATE TABLE "StoreAccessGrant" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "source" "StoreAccessSource" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreAccessGrant_storeId_source_endsAt_idx" ON "StoreAccessGrant"("storeId", "source", "endsAt");

-- CreateIndex
CREATE INDEX "StoreAccessGrant_grantedById_createdAt_idx" ON "StoreAccessGrant"("grantedById", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreAccessGrant" ADD CONSTRAINT "StoreAccessGrant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAccessGrant" ADD CONSTRAINT "StoreAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
