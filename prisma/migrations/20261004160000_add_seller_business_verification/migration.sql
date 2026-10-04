CREATE TYPE "SellerBusinessVerificationState" AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'VERIFIED',
  'MANUAL_REVIEW',
  'REJECTED',
  'REVERIFY_REQUIRED'
);

ALTER TABLE "SellerOnboardingDraft"
  ADD COLUMN "businessSiren" VARCHAR(9),
  ADD COLUMN "samePersonalBusinessAddress" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "displayBusinessAddress" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Store"
  ADD COLUMN "displayBusinessAddress" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "samePersonalBusinessAddress" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "establishmentId" TEXT;

ALTER TABLE "SellerBusiness"
  ADD COLUMN "siren" VARCHAR(9),
  ADD COLUMN "legalBusinessName" VARCHAR(160),
  ADD COLUMN "sellerLegalForm" "SellerLegalForm",
  ADD COLUMN "companySubtype" "SellerCompanySubtype",
  ADD COLUMN "vatStatus" "SellerVatStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "vatNumber" VARCHAR(80),
  ADD COLUMN "inseeVerificationState" "SellerBusinessVerificationState" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "inseeVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "inseeVerificationSource" VARCHAR(40),
  ADD COLUMN "inseeLegalUnitStatus" VARCHAR(12),
  ADD COLUMN "inseeLegalUnitName" VARCHAR(200),
  ADD COLUMN "inseeVerificationReason" VARCHAR(500),
  ADD COLUMN "inseeVerificationSnapshot" JSONB,
  ADD COLUMN "inseeLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "inseeRetryAfter" TIMESTAMP(3);

CREATE TABLE "SellerBusinessEstablishment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "siret" VARCHAR(14) NOT NULL,
  "verificationState" "SellerBusinessVerificationState" NOT NULL DEFAULT 'NOT_STARTED',
  "establishmentStatus" VARCHAR(12),
  "legalUnitSiren" VARCHAR(9) NOT NULL,
  "legalName" VARCHAR(200),
  "address" VARCHAR(240),
  "postalCode" VARCHAR(32),
  "city" VARCHAR(120),
  "country" VARCHAR(2),
  "verificationSource" VARCHAR(40),
  "verifiedAt" TIMESTAMP(3),
  "verificationReason" VARCHAR(500),
  "verificationSnapshot" JSONB,
  "lastAttemptAt" TIMESTAMP(3),
  "retryAfter" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerBusinessEstablishment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerBusiness_siren_key" ON "SellerBusiness"("siren");
CREATE UNIQUE INDEX "SellerBusinessEstablishment_businessId_siret_key" ON "SellerBusinessEstablishment"("businessId", "siret");
CREATE UNIQUE INDEX "SellerBusinessEstablishment_id_businessId_key" ON "SellerBusinessEstablishment"("id", "businessId");
CREATE INDEX "SellerBusinessEstablishment_businessId_verificationState_idx" ON "SellerBusinessEstablishment"("businessId", "verificationState");
CREATE INDEX "SellerBusinessEstablishment_siret_idx" ON "SellerBusinessEstablishment"("siret");
CREATE INDEX "Store_establishmentId_idx" ON "Store"("establishmentId");

ALTER TABLE "SellerBusinessEstablishment"
  ADD CONSTRAINT "SellerBusinessEstablishment_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Store"
  ADD CONSTRAINT "Store_establishmentId_businessId_fkey"
  FOREIGN KEY ("establishmentId", "businessId")
  REFERENCES "SellerBusinessEstablishment"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
