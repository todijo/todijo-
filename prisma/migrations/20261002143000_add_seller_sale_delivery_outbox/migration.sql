CREATE TYPE "SellerSaleEmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRYABLE', 'SENT', 'FAILED');

CREATE TABLE "SellerSaleDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderGroupId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "recipientEmail" VARCHAR(320) NOT NULL,
    "recipientName" VARCHAR(200) NOT NULL,
    "orderReference" VARCHAR(200) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "sellerAmountMinor" INTEGER NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "status" "SellerSaleEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorCode" VARCHAR(120),
    "errorMessage" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerSaleDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerSaleDelivery_orderGroupId_key" ON "SellerSaleDelivery"("orderGroupId");
CREATE UNIQUE INDEX "SellerSaleDelivery_notificationId_key" ON "SellerSaleDelivery"("notificationId");
CREATE UNIQUE INDEX "SellerSaleDelivery_claimToken_key" ON "SellerSaleDelivery"("claimToken");
CREATE INDEX "SellerSaleDelivery_status_nextAttemptAt_createdAt_idx" ON "SellerSaleDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "SellerSaleDelivery_sellerId_createdAt_idx" ON "SellerSaleDelivery"("sellerId", "createdAt");
CREATE INDEX "SellerSaleDelivery_orderId_idx" ON "SellerSaleDelivery"("orderId");

ALTER TABLE "SellerSaleDelivery" ADD CONSTRAINT "SellerSaleDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSaleDelivery" ADD CONSTRAINT "SellerSaleDelivery_orderGroupId_fkey" FOREIGN KEY ("orderGroupId") REFERENCES "OrderGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSaleDelivery" ADD CONSTRAINT "SellerSaleDelivery_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSaleDelivery" ADD CONSTRAINT "SellerSaleDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
