ALTER TABLE "SellerBusiness"
ADD COLUMN "sellerClosedAt" TIMESTAMP(3),
ADD COLUMN "reactivationStockReviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reactivationStockReviewedAt" TIMESTAMP(3),
ADD COLUMN "stripeCancellationPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeCancellationClaimToken" TEXT,
ADD COLUMN "stripeCancellationClaimedAt" TIMESTAMP(3);

CREATE TABLE "SellerClosureToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerClosureToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerClosureToken_tokenHash_key" ON "SellerClosureToken"("tokenHash");
CREATE UNIQUE INDEX "SellerBusiness_stripeCancellationClaimToken_key" ON "SellerBusiness"("stripeCancellationClaimToken");
CREATE INDEX "SellerClosureToken_businessId_createdAt_idx" ON "SellerClosureToken"("businessId", "createdAt");
CREATE INDEX "SellerClosureToken_userId_expiresAt_idx" ON "SellerClosureToken"("userId", "expiresAt");

ALTER TABLE "SellerClosureToken"
ADD CONSTRAINT "SellerClosureToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "SellerClosureToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
