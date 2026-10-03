CREATE TYPE "SellerSubscriptionReminderKind" AS ENUM (
  'DAYS_30',
  'DAYS_7',
  'DAYS_1',
  'ENTITLEMENT_LOST'
);

CREATE TABLE "SellerSubscriptionReminderDelivery" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "kind" "SellerSubscriptionReminderKind" NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "locale" VARCHAR(10) NOT NULL,
  "recipientEmail" VARCHAR(320) NOT NULL,
  "recipientName" VARCHAR(200) NOT NULL,
  "plan" VARCHAR(40) NOT NULL,
  "billingInterval" VARCHAR(20) NOT NULL,
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

  CONSTRAINT "SellerSubscriptionReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerSubscriptionReminderDelivery_claimToken_key"
ON "SellerSubscriptionReminderDelivery"("claimToken");

CREATE UNIQUE INDEX "SellerSubscriptionReminderDelivery_subscription_period_kind_key"
ON "SellerSubscriptionReminderDelivery"("subscriptionId", "periodEnd", "kind");

CREATE INDEX "SellerSubscriptionReminderDelivery_due_idx"
ON "SellerSubscriptionReminderDelivery"("status", "nextAttemptAt", "createdAt");

ALTER TABLE "SellerSubscriptionReminderDelivery"
ADD CONSTRAINT "SellerSubscriptionReminderDelivery_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "SellerSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
