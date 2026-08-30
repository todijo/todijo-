CREATE TYPE "CatalogTranslationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED');
CREATE TYPE "CatalogTranslationItemStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RETRYABLE', 'COMPLETED', 'SKIPPED', 'MANUAL_ACTION_REQUIRED', 'CANCELLED');
CREATE TYPE "CatalogTranslationAttemptStatus" AS ENUM ('RESERVED', 'SUBMITTED', 'SUCCEEDED', 'DEFINITE_FAILURE', 'AMBIGUOUS');
CREATE TYPE "CatalogTranslationApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "CatalogTranslationBudgetPeriod" AS ENUM ('DAY', 'MONTH');

CREATE TABLE "CatalogTranslationJob" (
    "id" TEXT NOT NULL,
    "status" "CatalogTranslationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" VARCHAR(40) NOT NULL,
    "providerVersion" VARCHAR(80) NOT NULL,
    "pipelineVersion" VARCHAR(80) NOT NULL,
    "sourceLocale" VARCHAR(12),
    "targetLocales" TEXT[],
    "requestedItemCount" INTEGER NOT NULL,
    "estimatedCharacters" BIGINT NOT NULL,
    "batchLimit" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogTranslationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogTranslationItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierProductLinkId" TEXT NOT NULL,
    "sourceLocale" VARCHAR(12) NOT NULL,
    "targetLocale" VARCHAR(12) NOT NULL,
    "sourceFingerprint" CHAR(64) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "providerVersion" VARCHAR(80) NOT NULL,
    "pipelineVersion" VARCHAR(80) NOT NULL,
    "status" "CatalogTranslationItemStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "claimToken" VARCHAR(64),
    "claimedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "estimatedCharacters" INTEGER NOT NULL,
    "submittedCharacters" INTEGER NOT NULL DEFAULT 0,
    "completedCharacters" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" VARCHAR(500),
    "proposalWrittenAt" TIMESTAMP(3),
    "approvalStatus" "CatalogTranslationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogTranslationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogTranslationAttempt" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "CatalogTranslationAttemptStatus" NOT NULL DEFAULT 'RESERVED',
    "providerRequestKey" VARCHAR(120) NOT NULL,
    "reservedCharacters" INTEGER NOT NULL,
    "submittedCharacters" INTEGER NOT NULL DEFAULT 0,
    "completedCharacters" INTEGER NOT NULL DEFAULT 0,
    "billedCharacters" INTEGER,
    "billingConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "dailyPeriodStart" TIMESTAMP(3) NOT NULL,
    "monthlyPeriodStart" TIMESTAMP(3) NOT NULL,
    "providerRequestId" VARCHAR(200),
    "safeErrorCode" VARCHAR(100),
    "safeErrorMessage" VARCHAR(500),
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogTranslationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogTranslationBudget" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "periodType" "CatalogTranslationBudgetPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "limitCharacters" BIGINT NOT NULL,
    "reservedCharacters" BIGINT NOT NULL DEFAULT 0,
    "submittedCharacters" BIGINT NOT NULL DEFAULT 0,
    "completedCharacters" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogTranslationBudget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogTranslationJob_status_createdAt_idx" ON "CatalogTranslationJob"("status", "createdAt");
CREATE INDEX "CatalogTranslationJob_createdById_createdAt_idx" ON "CatalogTranslationJob"("createdById", "createdAt");

CREATE UNIQUE INDEX "CatalogTranslationItem_idempotency_key"
ON "CatalogTranslationItem"("productId", "sourceFingerprint", "sourceLocale", "targetLocale", "provider", "providerVersion", "pipelineVersion");
CREATE INDEX "CatalogTranslationItem_status_nextAttemptAt_createdAt_idx" ON "CatalogTranslationItem"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "CatalogTranslationItem_status_leaseExpiresAt_idx" ON "CatalogTranslationItem"("status", "leaseExpiresAt");
CREATE INDEX "CatalogTranslationItem_jobId_status_idx" ON "CatalogTranslationItem"("jobId", "status");
CREATE INDEX "CatalogTranslationItem_productId_targetLocale_createdAt_idx" ON "CatalogTranslationItem"("productId", "targetLocale", "createdAt");
CREATE INDEX "CatalogTranslationItem_supplierProductLinkId_targetLocale_idx" ON "CatalogTranslationItem"("supplierProductLinkId", "targetLocale");

CREATE UNIQUE INDEX "CatalogTranslationAttempt_providerRequestKey_key" ON "CatalogTranslationAttempt"("providerRequestKey");
CREATE UNIQUE INDEX "CatalogTranslationAttempt_itemId_attemptNumber_key" ON "CatalogTranslationAttempt"("itemId", "attemptNumber");
CREATE INDEX "CatalogTranslationAttempt_itemId_status_idx" ON "CatalogTranslationAttempt"("itemId", "status");
CREATE INDEX "CatalogTranslationAttempt_status_submittedAt_idx" ON "CatalogTranslationAttempt"("status", "submittedAt");
CREATE INDEX "CatalogTranslationAttempt_dailyPeriodStart_status_idx" ON "CatalogTranslationAttempt"("dailyPeriodStart", "status");
CREATE INDEX "CatalogTranslationAttempt_monthlyPeriodStart_status_idx" ON "CatalogTranslationAttempt"("monthlyPeriodStart", "status");

CREATE UNIQUE INDEX "CatalogTranslationBudget_provider_periodType_periodStart_key" ON "CatalogTranslationBudget"("provider", "periodType", "periodStart");
CREATE INDEX "CatalogTranslationBudget_provider_periodType_periodStart_idx" ON "CatalogTranslationBudget"("provider", "periodType", "periodStart");

ALTER TABLE "CatalogTranslationJob"
ADD CONSTRAINT "CatalogTranslationJob_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogTranslationItem"
ADD CONSTRAINT "CatalogTranslationItem_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "CatalogTranslationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogTranslationItem"
ADD CONSTRAINT "CatalogTranslationItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogTranslationItem"
ADD CONSTRAINT "CatalogTranslationItem_supplierProductLinkId_fkey"
FOREIGN KEY ("supplierProductLinkId") REFERENCES "SupplierProductLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogTranslationItem"
ADD CONSTRAINT "CatalogTranslationItem_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CatalogTranslationAttempt"
ADD CONSTRAINT "CatalogTranslationAttempt_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "CatalogTranslationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
