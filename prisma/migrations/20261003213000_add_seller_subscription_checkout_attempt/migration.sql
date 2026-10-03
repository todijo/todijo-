ALTER TABLE "SellerSubscription"
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripeCheckoutUrl" TEXT,
  ADD COLUMN "stripeCheckoutExpiresAt" TIMESTAMP(3),
  ADD COLUMN "stripeCheckoutIdempotencyKey" VARCHAR(200),
  ADD COLUMN "stripeCheckoutAttemptGeneration" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "SellerSubscription_stripeCheckoutSessionId_key"
  ON "SellerSubscription"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX "SellerSubscription_stripeCheckoutIdempotencyKey_key"
  ON "SellerSubscription"("stripeCheckoutIdempotencyKey");
