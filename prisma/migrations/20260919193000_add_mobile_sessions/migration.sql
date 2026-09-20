CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "deviceLabel" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "authVersionAtIssue" INTEGER NOT NULL,

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileSession_refreshTokenHash_key" ON "MobileSession"("refreshTokenHash");
CREATE INDEX "MobileSession_userId_revokedAt_expiresAt_idx" ON "MobileSession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");

ALTER TABLE "MobileSession"
ADD CONSTRAINT "MobileSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
