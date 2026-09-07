ALTER TABLE "Product" ADD COLUMN "sourceLocale" VARCHAR(8) NOT NULL DEFAULT 'en';

ALTER TABLE "NewsArticleTranslation"
  ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceFingerprint" CHAR(64),
  ADD COLUMN "provider" VARCHAR(40),
  ADD COLUMN "providerVersion" VARCHAR(80);

CREATE TABLE "ProductTranslation" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "sourceFingerprint" CHAR(64),
  "provider" VARCHAR(40),
  "providerVersion" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");
CREATE INDEX "ProductTranslation_locale_productId_idx" ON "ProductTranslation"("locale", "productId");

CREATE TABLE "DynamicContentTranslationTask" (
  "id" TEXT NOT NULL,
  "entityType" VARCHAR(20) NOT NULL,
  "entityId" TEXT NOT NULL,
  "sourceLocale" VARCHAR(8) NOT NULL,
  "targetLocale" VARCHAR(8) NOT NULL,
  "sourceFingerprint" CHAR(64) NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "sourceContent" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimToken" VARCHAR(64),
  "leaseExpiresAt" TIMESTAMP(3),
  "estimatedCharacters" INTEGER NOT NULL,
  "lastErrorCode" VARCHAR(100),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DynamicContentTranslationTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DynamicContentTranslationTask_entityType_entityId_sourceFingerprint_targetLocale_key" ON "DynamicContentTranslationTask"("entityType", "entityId", "sourceFingerprint", "targetLocale");
CREATE INDEX "DynamicContentTranslationTask_status_nextAttemptAt_createdAt_idx" ON "DynamicContentTranslationTask"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "DynamicContentTranslationTask_status_leaseExpiresAt_idx" ON "DynamicContentTranslationTask"("status", "leaseExpiresAt");
