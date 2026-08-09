CREATE TYPE "OrderIssueType" AS ENUM ('CANCELLATION', 'RETURN', 'DISPUTE');
CREATE TYPE "OrderIssueStatus" AS ENUM ('PENDING', 'SELLER_APPROVED', 'SELLER_REJECTED', 'ESCALATED', 'RESOLVED');

CREATE TABLE "OrderIssue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "type" "OrderIssueType" NOT NULL,
    "status" "OrderIssueStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderLifecycleEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderIssue_orderId_type_key" ON "OrderIssue"("orderId", "type");
CREATE INDEX "OrderIssue_buyerId_createdAt_idx" ON "OrderIssue"("buyerId", "createdAt");
CREATE INDEX "OrderIssue_status_createdAt_idx" ON "OrderIssue"("status", "createdAt");
CREATE INDEX "OrderLifecycleEvent_orderId_createdAt_idx" ON "OrderLifecycleEvent"("orderId", "createdAt");
ALTER TABLE "OrderIssue" ADD CONSTRAINT "OrderIssue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLifecycleEvent" ADD CONSTRAINT "OrderLifecycleEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
