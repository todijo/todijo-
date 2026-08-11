-- Additive supplier ownership and permission foundation.
CREATE TYPE "SupplierOwnerType" AS ENUM ('PLATFORM', 'SELLER');
CREATE TYPE "SupplierConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'RECONNECT_REQUIRED', 'REVOKED');

ALTER TABLE "Store" ADD COLUMN "dropshippingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SupplierConnection" (
    "id" TEXT NOT NULL,
    "provider" "SupplierProvider" NOT NULL,
    "ownerType" "SupplierOwnerType" NOT NULL,
    "storeId" TEXT,
    "status" "SupplierConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "externalAccountId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastErrorCategory" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierConnection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierProductLink" ADD COLUMN "ownerType" "SupplierOwnerType" NOT NULL DEFAULT 'PLATFORM';
ALTER TABLE "SupplierProductLink" ADD COLUMN "connectionId" TEXT;

CREATE INDEX "SupplierConnection_ownerType_storeId_provider_status_idx" ON "SupplierConnection"("ownerType", "storeId", "provider", "status");
CREATE INDEX "SupplierConnection_provider_status_idx" ON "SupplierConnection"("provider", "status");
CREATE INDEX "SupplierProductLink_connectionId_syncStatus_lastSyncedAt_idx" ON "SupplierProductLink"("connectionId", "syncStatus", "lastSyncedAt");

ALTER TABLE "SupplierConnection" ADD CONSTRAINT "SupplierConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierProductLink" ADD CONSTRAINT "SupplierProductLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SupplierConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
