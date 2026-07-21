ALTER TABLE "Order" ADD COLUMN "checkoutRequestId" TEXT;
UPDATE "Order" SET "checkoutRequestId" = 'legacy-' || "id" WHERE "checkoutRequestId" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "checkoutRequestId" SET NOT NULL;
ALTER TABLE "Order" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripeCheckoutUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX "Order_buyerId_checkoutRequestId_key" ON "Order"("buyerId", "checkoutRequestId");
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
