CREATE TYPE "ShipmentStatus" AS ENUM ('SELLER_REPORTED', 'CARRIER_CONFIRMED', 'DELIVERED', 'CANCELLED');

CREATE TYPE "BuyerOrderEmailKind" AS ENUM ('PAYMENT_CONFIRMED', 'ORDER_SHIPPED', 'SHIPMENT_RECORDED');

CREATE TYPE "BuyerOrderEmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRYABLE', 'SENT', 'FAILED');

ALTER TYPE "FulfillmentStatus" ADD VALUE 'PARTIALLY_SHIPPED';

ALTER TABLE "Order"
  ADD COLUMN "buyerLocale" VARCHAR(10);

ALTER TABLE "OrderGroup"
  ADD COLUMN "sellerDispatchReportedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_id_buyerId_key" ON "Order"("id", "buyerId");
CREATE UNIQUE INDEX "OrderGroup_id_orderId_storeId_key" ON "OrderGroup"("id", "orderId", "storeId");
CREATE UNIQUE INDEX "OrderItem_id_orderGroupId_key" ON "OrderItem"("id", "orderGroupId");

CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderGroupId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdById" TEXT,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'SELLER_REPORTED',
  "carrier" VARCHAR(120),
  "trackingNumber" VARCHAR(160),
  "trackingUrl" VARCHAR(500),
  "sellerReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "carrierAcceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Shipment_orderGroupId_orderId_storeId_fkey" FOREIGN KEY ("orderGroupId", "orderId", "storeId") REFERENCES "OrderGroup"("id", "orderId", "storeId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Shipment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Shipment_orderGroupId_idempotencyKey_key" ON "Shipment"("orderGroupId", "idempotencyKey");
CREATE UNIQUE INDEX "Shipment_id_orderGroupId_key" ON "Shipment"("id", "orderGroupId");
CREATE UNIQUE INDEX "Shipment_id_orderId_key" ON "Shipment"("id", "orderId");
CREATE INDEX "Shipment_orderId_createdAt_idx" ON "Shipment"("orderId", "createdAt");
CREATE INDEX "Shipment_storeId_sellerReportedAt_idx" ON "Shipment"("storeId", "sellerReportedAt");
CREATE INDEX "Shipment_orderGroupId_status_idx" ON "Shipment"("orderGroupId", "status");

CREATE TABLE "ShipmentItem" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "orderGroupId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "ShipmentItem_shipmentId_orderGroupId_fkey" FOREIGN KEY ("shipmentId", "orderGroupId") REFERENCES "Shipment"("id", "orderGroupId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShipmentItem_orderItemId_orderGroupId_fkey" FOREIGN KEY ("orderItemId", "orderGroupId") REFERENCES "OrderItem"("id", "orderGroupId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShipmentItem_shipmentId_orderItemId_key" ON "ShipmentItem"("shipmentId", "orderItemId");
CREATE INDEX "ShipmentItem_orderItemId_createdAt_idx" ON "ShipmentItem"("orderItemId", "createdAt");

CREATE TABLE "BuyerOrderEmailDelivery" (
  "id" TEXT NOT NULL,
  "eventKey" VARCHAR(240) NOT NULL,
  "kind" "BuyerOrderEmailKind" NOT NULL,
  "orderId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "shipmentId" TEXT,
  "locale" VARCHAR(10) NOT NULL,
  "recipientEmail" VARCHAR(320) NOT NULL,
  "recipientName" VARCHAR(200) NOT NULL,
  "orderReference" VARCHAR(200) NOT NULL,
  "storeName" VARCHAR(200),
  "items" JSONB,
  "status" "BuyerOrderEmailStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "errorCode" VARCHAR(120),
  "errorMessage" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerOrderEmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BuyerOrderEmailDelivery_attemptCount_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "BuyerOrderEmailDelivery_orderId_buyerId_fkey" FOREIGN KEY ("orderId", "buyerId") REFERENCES "Order"("id", "buyerId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuyerOrderEmailDelivery_shipmentId_orderId_fkey" FOREIGN KEY ("shipmentId", "orderId") REFERENCES "Shipment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BuyerOrderEmailDelivery_eventKey_key" ON "BuyerOrderEmailDelivery"("eventKey");
CREATE UNIQUE INDEX "BuyerOrderEmailDelivery_shipmentId_key" ON "BuyerOrderEmailDelivery"("shipmentId");
CREATE UNIQUE INDEX "BuyerOrderEmailDelivery_claimToken_key" ON "BuyerOrderEmailDelivery"("claimToken");
CREATE UNIQUE INDEX "BuyerOrderEmailDelivery_shipmentId_orderId_key" ON "BuyerOrderEmailDelivery"("shipmentId", "orderId");
CREATE INDEX "BuyerOrderEmailDelivery_status_nextAttemptAt_createdAt_idx" ON "BuyerOrderEmailDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "BuyerOrderEmailDelivery_buyerId_createdAt_idx" ON "BuyerOrderEmailDelivery"("buyerId", "createdAt");
CREATE INDEX "BuyerOrderEmailDelivery_orderId_kind_idx" ON "BuyerOrderEmailDelivery"("orderId", "kind");
