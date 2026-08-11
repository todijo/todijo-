CREATE TYPE "SupplierFulfillmentStatus" AS ENUM ('PENDING', 'SUBMITTING', 'SUBMITTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETRYABLE', 'AMBIGUOUS', 'MANUAL_ACTION_REQUIRED', 'CANCELLED');

CREATE TABLE "SupplierFulfillment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "connectionId" TEXT,
  "provider" "SupplierProvider" NOT NULL,
  "externalReference" VARCHAR(50) NOT NULL,
  "status" "SupplierFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  "originCountry" VARCHAR(2),
  "destinationCountry" VARCHAR(2),
  "shippingMethod" VARCHAR(80),
  "supplierOrderId" VARCHAR(120),
  "supplierOrderNumber" VARCHAR(120),
  "supplierStatus" VARCHAR(80),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "claimToken" VARCHAR(64),
  "claimedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastErrorCategory" VARCHAR(40),
  "lastErrorCode" VARCHAR(120),
  "lastErrorMessage" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierFulfillmentItem" (
  "id" TEXT NOT NULL,
  "fulfillmentId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "supplierProductId" VARCHAR(200) NOT NULL,
  "supplierVariantId" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "SupplierFulfillmentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierTracking" (
  "id" TEXT NOT NULL,
  "fulfillmentId" TEXT NOT NULL,
  "supplierShipmentId" VARCHAR(120),
  "carrier" VARCHAR(120),
  "trackingNumber" VARCHAR(160) NOT NULL,
  "trackingUrl" VARCHAR(500),
  "shippedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierTracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierFulfillment_externalReference_key" ON "SupplierFulfillment"("externalReference");
CREATE INDEX "SupplierFulfillment_orderId_status_idx" ON "SupplierFulfillment"("orderId", "status");
CREATE INDEX "SupplierFulfillment_connectionId_status_updatedAt_idx" ON "SupplierFulfillment"("connectionId", "status", "updatedAt");
CREATE UNIQUE INDEX "SupplierFulfillmentItem_orderItemId_key" ON "SupplierFulfillmentItem"("orderItemId");
CREATE INDEX "SupplierFulfillmentItem_fulfillmentId_idx" ON "SupplierFulfillmentItem"("fulfillmentId");
CREATE UNIQUE INDEX "SupplierTracking_fulfillmentId_trackingNumber_key" ON "SupplierTracking"("fulfillmentId", "trackingNumber");
CREATE INDEX "SupplierTracking_fulfillmentId_createdAt_idx" ON "SupplierTracking"("fulfillmentId", "createdAt");

ALTER TABLE "SupplierFulfillment" ADD CONSTRAINT "SupplierFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillment" ADD CONSTRAINT "SupplierFulfillment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SupplierConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentItem" ADD CONSTRAINT "SupplierFulfillmentItem_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "SupplierFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentItem" ADD CONSTRAINT "SupplierFulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierTracking" ADD CONSTRAINT "SupplierTracking_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "SupplierFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
