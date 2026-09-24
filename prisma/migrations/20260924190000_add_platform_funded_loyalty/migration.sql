-- Additive platform-funded admin grants. Existing seller-funded grants remain
-- unchanged and retain SELLER_RESERVE as their explicit funding source.
CREATE TYPE "LoyaltyFundingSource" AS ENUM ('SELLER_RESERVE', 'PLATFORM_ADMIN');

ALTER TABLE "LoyaltyGrant"
    ADD COLUMN "fundingSource" "LoyaltyFundingSource" NOT NULL DEFAULT 'SELLER_RESERVE',
    ALTER COLUMN "orderItemId" DROP NOT NULL,
    ALTER COLUMN "orderGroupId" DROP NOT NULL;

ALTER TABLE "LoyaltyGrant" ADD CONSTRAINT "LoyaltyGrant_funding_source_shape" CHECK (
    ("fundingSource" = 'SELLER_RESERVE' AND "orderItemId" IS NOT NULL AND "orderGroupId" IS NOT NULL)
    OR ("fundingSource" = 'PLATFORM_ADMIN' AND "orderItemId" IS NULL AND "orderGroupId" IS NULL AND "rateBps" = 0)
);

-- Every monetary ledger movement is traceable to a funding-typed grant.
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_monetary_grant_required"
    CHECK ("amountMinor" = 0 OR "grantId" IS NOT NULL);

CREATE TABLE "LoyaltyPlatformFunding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reference" VARCHAR(200) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyPlatformFunding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyPlatformFunding_positive_amount" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "LoyaltyPlatformFunding_grantId_key" ON "LoyaltyPlatformFunding"("grantId");
CREATE UNIQUE INDEX "LoyaltyPlatformFunding_reference_key" ON "LoyaltyPlatformFunding"("reference");
CREATE INDEX "LoyaltyPlatformFunding_accountId_createdAt_idx" ON "LoyaltyPlatformFunding"("accountId", "createdAt");
CREATE INDEX "LoyaltyPlatformFunding_adminId_createdAt_idx" ON "LoyaltyPlatformFunding"("adminId", "createdAt");
ALTER TABLE "LoyaltyPlatformFunding" ADD CONSTRAINT "LoyaltyPlatformFunding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyPlatformFunding" ADD CONSTRAINT "LoyaltyPlatformFunding_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "LoyaltyGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyPlatformFunding" ADD CONSTRAINT "LoyaltyPlatformFunding_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LoyaltyPlatformFundingAttestation" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "evidenceReference" VARCHAR(200) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyPlatformFundingAttestation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoyaltyPlatformFundingAttestation_fundingId_key" ON "LoyaltyPlatformFundingAttestation"("fundingId");
CREATE UNIQUE INDEX "LoyaltyPlatformFundingAttestation_evidenceReference_key" ON "LoyaltyPlatformFundingAttestation"("evidenceReference");
CREATE INDEX "LoyaltyPlatformFundingAttestation_verifierId_createdAt_idx" ON "LoyaltyPlatformFundingAttestation"("verifierId", "createdAt");
ALTER TABLE "LoyaltyPlatformFundingAttestation" ADD CONSTRAINT "LoyaltyPlatformFundingAttestation_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "LoyaltyPlatformFunding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyPlatformFundingAttestation" ADD CONSTRAINT "LoyaltyPlatformFundingAttestation_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "LoyaltyPlatformFundingAttestation_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyPlatformFundingAttestation"
FOR EACH ROW EXECUTE FUNCTION loyalty_reject_history_mutation();

CREATE TRIGGER "LoyaltyPlatformFunding_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyPlatformFunding"
FOR EACH ROW EXECUTE FUNCTION loyalty_reject_history_mutation();
