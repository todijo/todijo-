CREATE TABLE "MobileOAuthAttempt" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "exchangeCodeHash" CHAR(64),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "MobileOAuthAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MobileOAuthAttempt_stateHash_key" ON "MobileOAuthAttempt"("stateHash");
CREATE UNIQUE INDEX "MobileOAuthAttempt_exchangeCodeHash_key" ON "MobileOAuthAttempt"("exchangeCodeHash");
CREATE INDEX "MobileOAuthAttempt_expiresAt_idx" ON "MobileOAuthAttempt"("expiresAt");
CREATE INDEX "MobileOAuthAttempt_userId_consumedAt_idx" ON "MobileOAuthAttempt"("userId", "consumedAt");
ALTER TABLE "MobileOAuthAttempt" ADD CONSTRAINT "MobileOAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
