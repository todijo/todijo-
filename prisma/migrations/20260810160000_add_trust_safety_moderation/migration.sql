ALTER TYPE "ProductReportReason" ADD VALUE 'COUNTERFEIT';
ALTER TYPE "ProductReportReason" ADD VALUE 'INTELLECTUAL_PROPERTY';
ALTER TYPE "ProductReportStatus" ADD VALUE 'UNDER_REVIEW';

ALTER TABLE "ProductReport"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionNote" VARCHAR(1000);

CREATE TABLE "ProductModerationEvent" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "ProductReportStatus" NOT NULL,
  "toStatus" "ProductReportStatus" NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "note" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductReport_reviewedById_reviewedAt_idx" ON "ProductReport"("reviewedById", "reviewedAt");
CREATE INDEX "ProductModerationEvent_reportId_createdAt_idx" ON "ProductModerationEvent"("reportId", "createdAt");
CREATE INDEX "ProductModerationEvent_actorId_createdAt_idx" ON "ProductModerationEvent"("actorId", "createdAt");
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductModerationEvent" ADD CONSTRAINT "ProductModerationEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProductReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModerationEvent" ADD CONSTRAINT "ProductModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
