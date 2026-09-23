ALTER TYPE "OrderIssueStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "OrderIssueStatus" ADD VALUE IF NOT EXISTS 'ADMIN_APPROVED';
ALTER TYPE "OrderIssueStatus" ADD VALUE IF NOT EXISTS 'ADMIN_REJECTED';

CREATE TYPE "ProductRecallStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "ProductRecall" (
  "id" TEXT NOT NULL,
  "status" "ProductRecallStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" VARCHAR(1000) NOT NULL,
  "evidence" VARCHAR(2000),
  "reference" VARCHAR(300),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" VARCHAR(1000),
  CONSTRAINT "ProductRecall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecallKey" (
  "id" TEXT NOT NULL,
  "recallId" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "value" VARCHAR(200) NOT NULL,
  CONSTRAINT "ProductRecallKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecallEvent" (
  "id" TEXT NOT NULL,
  "recallId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductRecallEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductRecall_status_createdAt_idx" ON "ProductRecall"("status", "createdAt");
CREATE UNIQUE INDEX "ProductRecallKey_provider_kind_value_key" ON "ProductRecallKey"("provider", "kind", "value");
CREATE INDEX "ProductRecallKey_recallId_idx" ON "ProductRecallKey"("recallId");
CREATE INDEX "ProductRecallEvent_recallId_createdAt_idx" ON "ProductRecallEvent"("recallId", "createdAt");
ALTER TABLE "ProductRecallKey" ADD CONSTRAINT "ProductRecallKey_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "ProductRecall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductRecallEvent" ADD CONSTRAINT "ProductRecallEvent_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "ProductRecall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
