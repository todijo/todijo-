CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'EXPIRED');
CREATE TYPE "ProductDeactivationReason" AS ENUM ('NONE', 'SELLER', 'ADMIN', 'SUBSCRIPTION_INACTIVE');

ALTER TABLE "Store"
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "stripeCustomerId" TEXT;
UPDATE "Store" SET "contactEmail" = "User"."email" FROM "User" WHERE "Store"."ownerId" = "User"."id";
ALTER TABLE "Store" ALTER COLUMN "contactEmail" SET NOT NULL;
CREATE UNIQUE INDEX "Store_stripeCustomerId_key" ON "Store"("stripeCustomerId");

ALTER TABLE "Product" ADD COLUMN "deactivationReason" "ProductDeactivationReason" NOT NULL DEFAULT 'NONE';
UPDATE "Product" SET "status" = 'DRAFT', "deactivationReason" = 'SUBSCRIPTION_INACTIVE' WHERE "status" = 'PUBLISHED';

CREATE TABLE "SellerSubscription" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT,
  "stripePriceId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerSubscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerSubscription_storeId_key" ON "SellerSubscription"("storeId");
CREATE UNIQUE INDEX "SellerSubscription_stripeSubscriptionId_key" ON "SellerSubscription"("stripeSubscriptionId");
CREATE INDEX "SellerSubscription_status_idx" ON "SellerSubscription"("status");
