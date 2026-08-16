CREATE TYPE "AdminUserActionType" AS ENUM ('BLOCK', 'UNBLOCK', 'SELLER_SUSPEND', 'SELLER_RESTORE', 'ANONYMIZE');

ALTER TABLE "User"
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "blockExpiresAt" TIMESTAMP(3),
  ADD COLUMN "blockReason" VARCHAR(1000),
  ADD COLUMN "sellerSuspendedAt" TIMESTAMP(3),
  ADD COLUMN "sellerSuspensionReason" VARCHAR(1000),
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedEmailHash" CHAR(64);

CREATE TABLE "AdminUserAction" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" "AdminUserActionType" NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "previousStatus" JSONB NOT NULL,
  "newStatus" JSONB NOT NULL,
  "blockExpiresAt" TIMESTAMP(3),
  "correlationId" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUserAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_anonymizedEmailHash_key" ON "User"("anonymizedEmailHash");
CREATE INDEX "User_blockedAt_blockExpiresAt_idx" ON "User"("blockedAt", "blockExpiresAt");
CREATE INDEX "User_sellerSuspendedAt_idx" ON "User"("sellerSuspendedAt");
CREATE INDEX "User_deactivatedAt_idx" ON "User"("deactivatedAt");
CREATE INDEX "AdminUserAction_targetUserId_createdAt_idx" ON "AdminUserAction"("targetUserId", "createdAt");
CREATE INDEX "AdminUserAction_actorAdminId_createdAt_idx" ON "AdminUserAction"("actorAdminId", "createdAt");
CREATE INDEX "AdminUserAction_action_createdAt_idx" ON "AdminUserAction"("action", "createdAt");
ALTER TABLE "AdminUserAction" ADD CONSTRAINT "AdminUserAction_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminUserAction" ADD CONSTRAINT "AdminUserAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
