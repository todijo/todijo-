-- CreateEnum
CREATE TYPE "OrderSnapshotSource" AS ENUM ('CHECKOUT_CAPTURED', 'LEGACY_RECONSTRUCTED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FulfillmentEventSource" AS ENUM ('SYSTEM', 'SELLER', 'ADMIN');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "snapshotSource" "OrderSnapshotSource",
  ADD COLUMN "snapshotCapturedAt" TIMESTAMP(3),
  ADD COLUMN "storeIdSnapshot" TEXT,
  ADD COLUMN "storeNameSnapshot" TEXT,
  ADD COLUMN "storeSnapshot" JSONB,
  ADD COLUMN "buyerNameSnapshot" TEXT,
  ADD COLUMN "buyerEmailSnapshot" TEXT,
  ADD COLUMN "buyerPhoneSnapshot" TEXT,
  ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "recipientEmail" TEXT,
  ADD COLUMN "recipientPhone" TEXT,
  ADD COLUMN "shippingAddressLine1" TEXT,
  ADD COLUMN "shippingAddressLine2" TEXT,
  ADD COLUMN "shippingCity" TEXT,
  ADD COLUMN "shippingPostalCode" TEXT,
  ADD COLUMN "shippingState" TEXT,
  ADD COLUMN "shippingCountry" TEXT,
  ADD COLUMN "shippingMethod" TEXT,
  ADD COLUMN "shippingCost" DECIMAL(12,2),
  ADD COLUMN "shippingCurrency" VARCHAR(3),
  ADD COLUMN "subtotal" DECIMAL(12,2),
  ADD COLUMN "taxTotal" DECIMAL(12,2),
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus",
  ADD COLUMN "processingAt" TIMESTAMP(3),
  ADD COLUMN "packedAt" TIMESTAMP(3),
  ADD COLUMN "shippedAt" TIMESTAMP(3),
  ADD COLUMN "trackingCarrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "trackingUrl" TEXT,
  ADD COLUMN "shippingCapturedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem"
  ADD COLUMN "lineKey" TEXT,
  ADD COLUMN "productNameSnapshot" TEXT,
  ADD COLUMN "productDescriptionSnapshot" TEXT,
  ADD COLUMN "productImageUrlSnapshot" TEXT,
  ADD COLUMN "productSkuSnapshot" TEXT,
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "lineTotal" DECIMAL(12,2),
  ADD COLUMN "selectedSize" TEXT,
  ADD COLUMN "selectedColor" TEXT,
  ADD COLUMN "selectedOptions" JSONB;

-- CreateTable
CREATE TABLE "OrderFulfillmentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "FulfillmentStatus" NOT NULL,
  "source" "FulfillmentEventSource" NOT NULL,
  "actorId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "OrderFulfillmentEvent_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "OrderItem_orderId_productId_key";

-- CreateIndex
CREATE INDEX "Order_storeIdSnapshot_idx" ON "Order"("storeIdSnapshot");
CREATE INDEX "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");
CREATE UNIQUE INDEX "OrderItem_orderId_lineKey_key" ON "OrderItem"("orderId", "lineKey");
CREATE INDEX "OrderFulfillmentEvent_orderId_occurredAt_idx" ON "OrderFulfillmentEvent"("orderId", "occurredAt");

-- AddForeignKey
ALTER TABLE "OrderFulfillmentEvent" ADD CONSTRAINT "OrderFulfillmentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
