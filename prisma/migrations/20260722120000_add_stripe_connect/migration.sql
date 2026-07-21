ALTER TABLE "User"
  ADD COLUMN "stripeAccountId" TEXT,
  ADD COLUMN "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

ALTER TABLE "Order"
  ADD COLUMN "stripeConnectedAccountId" TEXT,
  ADD COLUMN "platformFeeAmount" INTEGER,
  ADD COLUMN "sellerAmount" INTEGER;
