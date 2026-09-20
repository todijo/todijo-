CREATE TABLE "MobileRegistrationAttempt" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "emailHash" CHAR(64) NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "nonceHash" CHAR(64) NOT NULL,
    "exchangeCodeHash" CHAR(64),
    "registrationProofHash" CHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "turnstileVerifiedAt" TIMESTAMP(3),
    "exchangeConsumedAt" TIMESTAMP(3),
    "registrationConsumedAt" TIMESTAMP(3),

    CONSTRAINT "MobileRegistrationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileRegistrationAttempt_stateHash_key" ON "MobileRegistrationAttempt"("stateHash");
CREATE UNIQUE INDEX "MobileRegistrationAttempt_exchangeCodeHash_key" ON "MobileRegistrationAttempt"("exchangeCodeHash");
CREATE UNIQUE INDEX "MobileRegistrationAttempt_registrationProofHash_key" ON "MobileRegistrationAttempt"("registrationProofHash");
CREATE INDEX "MobileRegistrationAttempt_expiresAt_idx" ON "MobileRegistrationAttempt"("expiresAt");
CREATE INDEX "MobileRegistrationAttempt_emailHash_expiresAt_idx" ON "MobileRegistrationAttempt"("emailHash", "expiresAt");
