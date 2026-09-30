ALTER TABLE "SellerSubscription"
  ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN "scheduledPlan" TEXT,
  ADD COLUMN "scheduledBillingInterval" TEXT,
  ADD COLUMN "scheduledChangeAt" TIMESTAMP(3);

ALTER TABLE "StoreAccessGrant"
  ADD COLUMN "plan" TEXT;

CREATE INDEX "SellerSubscription_scheduledChangeAt_idx"
  ON "SellerSubscription"("scheduledChangeAt");
