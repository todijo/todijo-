-- Forward-only production repair for the complete seller onboarding schema.
-- This migration has a new identity and must be executed by `prisma migrate deploy`.
-- It never drops a table, column, or row.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SellerStatus') THEN
    CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductDeactivationReason') THEN
    CREATE TYPE "ProductDeactivationReason" AS ENUM ('NONE', 'SELLER', 'ADMIN', 'SUBSCRIPTION_INACTIVE');
  END IF;
END
$$;

ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "SellerStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "ProductDeactivationReason" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "ProductDeactivationReason" ADD VALUE IF NOT EXISTS 'SELLER';
ALTER TYPE "ProductDeactivationReason" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "ProductDeactivationReason" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_INACTIVE';

-- Complete every Store field used by seller onboarding. Existing values are
-- retained, while missing required values receive safe backfills.
ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "banner" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "status" "SellerStatus" DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Preserve logos from installations that used the earlier physical column
-- name `logo`. The Prisma field `logo` now maps to the canonical `logoUrl`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Store'
      AND column_name = 'logo'
  ) THEN
    EXECUTE 'UPDATE "Store" SET "logoUrl" = COALESCE("logoUrl", "logo") WHERE "logoUrl" IS NULL';
  END IF;
END
$$;

UPDATE "Store" AS store
SET "contactEmail" = owner."email"
FROM "User" AS owner
WHERE store."ownerId" = owner."id"
  AND store."contactEmail" IS NULL;

UPDATE "Store"
SET
  "country" = COALESCE("country", 'Unknown'),
  "city" = COALESCE("city", 'Unknown'),
  "currency" = COALESCE(NULLIF("currency", ''), 'EUR'),
  "language" = COALESCE(NULLIF("language", ''), 'fr'),
  "status" = COALESCE("status", 'PENDING');

ALTER TABLE "Store"
  ALTER COLUMN "country" SET NOT NULL,
  ALTER COLUMN "city" SET NOT NULL,
  ALTER COLUMN "contactEmail" SET NOT NULL,
  ALTER COLUMN "currency" SET DEFAULT 'EUR',
  ALTER COLUMN "currency" SET NOT NULL,
  ALTER COLUMN "language" SET DEFAULT 'fr',
  ALTER COLUMN "language" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "status" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Store_stripeCustomerId_key"
  ON "Store"("stripeCustomerId");

-- Product subscription deactivation state.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "deactivationReason" "ProductDeactivationReason" DEFAULT 'NONE';

UPDATE "Product"
SET "deactivationReason" = 'NONE'
WHERE "deactivationReason" IS NULL;

ALTER TABLE "Product"
  ALTER COLUMN "deactivationReason" SET DEFAULT 'NONE',
  ALTER COLUMN "deactivationReason" SET NOT NULL;

-- Create the subscription table when absent.
CREATE TABLE IF NOT EXISTS "SellerSubscription" (
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
  CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id")
);

-- Repair a partially created subscription table without deleting its rows.
ALTER TABLE "SellerSubscription"
  ADD COLUMN IF NOT EXISTS "id" TEXT DEFAULT md5(random()::text || clock_timestamp()::text),
  ADD COLUMN IF NOT EXISTS "storeId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT DEFAULT 'legacy_unknown',
  ADD COLUMN IF NOT EXISTS "plan" TEXT DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS "status" "SubscriptionStatus" DEFAULT 'INCOMPLETE',
  ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "SellerSubscription"
SET
  "id" = COALESCE("id", md5(random()::text || clock_timestamp()::text)),
  "stripePriceId" = COALESCE("stripePriceId", 'legacy_unknown'),
  "plan" = COALESCE("plan", 'legacy'),
  "status" = COALESCE("status", 'INCOMPLETE'),
  "cancelAtPeriodEnd" = COALESCE("cancelAtPeriodEnd", false),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "SellerSubscription"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "storeId" SET NOT NULL,
  ALTER COLUMN "stripePriceId" SET NOT NULL,
  ALTER COLUMN "stripePriceId" DROP DEFAULT,
  ALTER COLUMN "plan" SET NOT NULL,
  ALTER COLUMN "plan" DROP DEFAULT,
  ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "cancelAtPeriodEnd" SET DEFAULT false,
  ALTER COLUMN "cancelAtPeriodEnd" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SellerSubscription_pkey'
      AND conrelid = '"SellerSubscription"'::regclass
  ) THEN
    ALTER TABLE "SellerSubscription"
      ADD CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SellerSubscription_storeId_fkey'
      AND conrelid = '"SellerSubscription"'::regclass
  ) THEN
    ALTER TABLE "SellerSubscription"
      ADD CONSTRAINT "SellerSubscription_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END
$$;

ALTER TABLE "SellerSubscription"
  VALIDATE CONSTRAINT "SellerSubscription_storeId_fkey";

CREATE UNIQUE INDEX IF NOT EXISTS "SellerSubscription_storeId_key"
  ON "SellerSubscription"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "SellerSubscription_stripeSubscriptionId_key"
  ON "SellerSubscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "SellerSubscription_status_idx"
  ON "SellerSubscription"("status");

-- Pause only listings whose store has no currently publishable subscription.
-- Manually/admin disabled products and active subscribers are not changed.
UPDATE "Product" AS product
SET
  "status" = 'DRAFT',
  "deactivationReason" = 'SUBSCRIPTION_INACTIVE'
WHERE product."status" = 'PUBLISHED'
  AND product."deactivationReason" = 'NONE'
  AND NOT EXISTS (
    SELECT 1
    FROM "SellerSubscription" AS subscription
    WHERE subscription."storeId" = product."storeId"
      AND subscription."status" IN ('ACTIVE', 'TRIALING')
  );
