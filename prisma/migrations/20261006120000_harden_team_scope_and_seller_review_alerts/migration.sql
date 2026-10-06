CREATE TYPE "TeamProductScope" AS ENUM ('ALL_PRODUCTS', 'SELECTED_CATEGORIES');

ALTER TABLE "SellerTeamStoreAssignment"
  ADD COLUMN "productScope" "TeamProductScope" NOT NULL DEFAULT 'ALL_PRODUCTS',
  ADD COLUMN "categoryKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SellerTeamInvitationStore"
  ADD COLUMN "productScope" "TeamProductScope" NOT NULL DEFAULT 'ALL_PRODUCTS',
  ADD COLUMN "categoryKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Store"
  ADD COLUMN "sellerReviewSubmissionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SellerReviewEmailDelivery" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "submissionVersion" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "errorCode" VARCHAR(120),
  CONSTRAINT "SellerReviewEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerReviewEmailDelivery_storeId_submissionVersion_key"
  ON "SellerReviewEmailDelivery"("storeId", "submissionVersion");
CREATE INDEX "SellerReviewEmailDelivery_status_createdAt_idx"
  ON "SellerReviewEmailDelivery"("status", "createdAt");

ALTER TABLE "SellerReviewEmailDelivery"
  ADD CONSTRAINT "SellerReviewEmailDelivery_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
