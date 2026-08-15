-- Additive account/authentication/seller-onboarding V2 foundation.
-- Existing users, roles, stores, password hashes and commerce records are preserved.
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'FACEBOOK');
CREATE TYPE "SellerOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_INFORMATION');
CREATE TYPE "SellerLegalForm" AS ENUM ('PRIVATE', 'SOLE_TRADER', 'COMPANY', 'ASSOCIATION', 'OTHER');

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "profileAddress" VARCHAR(240),
  ADD COLUMN "profilePostalCode" VARCHAR(32),
  ADD COLUMN "profileCity" VARCHAR(120),
  ADD COLUMN "profileCountry" VARCHAR(2),
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Store"
  ADD COLUMN "onboardingStatus" "SellerOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellerLegalForm" "SellerLegalForm";

CREATE TABLE "OAuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  "providerEmail" VARCHAR(320),
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE INDEX "OAuthAccount_userId_provider_idx" ON "OAuthAccount"("userId", "provider");

CREATE TABLE "EmailChangeToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "newEmail" VARCHAR(320) NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailChangeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailChangeToken_tokenHash_key" ON "EmailChangeToken"("tokenHash");
CREATE INDEX "EmailChangeToken_userId_expiresAt_idx" ON "EmailChangeToken"("userId", "expiresAt");

CREATE TABLE "AccountSecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountSecurityEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccountSecurityEvent_userId_createdAt_idx" ON "AccountSecurityEvent"("userId", "createdAt");

CREATE TABLE "SellerOnboardingDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeName" VARCHAR(120),
  "country" VARCHAR(2),
  "city" VARCHAR(120),
  "phone" VARCHAR(40),
  "address" VARCHAR(240),
  "postalCode" VARCHAR(32),
  "sellerType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
  "legalForm" "SellerLegalForm",
  "businessRegistrationNumber" VARCHAR(80),
  "legalBusinessName" VARCHAR(160),
  "vatStatus" "SellerVatStatus" NOT NULL DEFAULT 'UNKNOWN',
  "vatNumber" VARCHAR(80),
  "step" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerOnboardingDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerOnboardingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerOnboardingDraft_userId_key" ON "SellerOnboardingDraft"("userId");
