CREATE TYPE "SellerSubscriptionChangeOperation" AS ENUM ('UPGRADE', 'SCHEDULE', 'CANCEL_SCHEDULE');
CREATE TYPE "SellerSubscriptionChangeStatus" AS ENUM ('PREPARED', 'AWAITING_PAYMENT', 'SCHEDULED', 'APPLIED', 'FAILED', 'CANCELED', 'EXPIRED');

CREATE TABLE "SellerSubscriptionChange" (
    "id" TEXT NOT NULL,
    "sellerSubscriptionId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeSubscriptionItemId" TEXT NOT NULL,
    "operation" "SellerSubscriptionChangeOperation" NOT NULL,
    "status" "SellerSubscriptionChangeStatus" NOT NULL DEFAULT 'PREPARED',
    "sourcePlan" TEXT NOT NULL,
    "sourceBillingInterval" TEXT NOT NULL,
    "sourcePriceId" TEXT NOT NULL,
    "targetPlan" TEXT NOT NULL,
    "targetBillingInterval" TEXT NOT NULL,
    "targetPriceId" TEXT NOT NULL,
    "sourcePeriodEnd" TIMESTAMP(3) NOT NULL,
    "prorationAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "stripeInvoiceId" TEXT,
    "stripeScheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerSubscriptionChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerSubscriptionChange_stripeInvoiceId_key" ON "SellerSubscriptionChange"("stripeInvoiceId");
CREATE INDEX "SellerSubscriptionChange_sellerSubscriptionId_createdAt_idx" ON "SellerSubscriptionChange"("sellerSubscriptionId", "createdAt");
CREATE INDEX "SellerSubscriptionChange_stripeSubscriptionId_status_idx" ON "SellerSubscriptionChange"("stripeSubscriptionId", "status");
CREATE INDEX "SellerSubscriptionChange_stripeScheduleId_idx" ON "SellerSubscriptionChange"("stripeScheduleId");
CREATE UNIQUE INDEX "SellerSubscriptionChange_one_pending" ON "SellerSubscriptionChange"("sellerSubscriptionId") WHERE "status" IN ('PREPARED', 'AWAITING_PAYMENT');
CREATE UNIQUE INDEX "SellerSubscriptionChange_one_scheduled" ON "SellerSubscriptionChange"("sellerSubscriptionId") WHERE "status" = 'SCHEDULED';

ALTER TABLE "SellerSubscriptionChange" ADD CONSTRAINT "SellerSubscriptionChange_sellerSubscriptionId_fkey" FOREIGN KEY ("sellerSubscriptionId") REFERENCES "SellerSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
