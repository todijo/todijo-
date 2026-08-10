ALTER TABLE "Store"
  ADD COLUMN "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shippingMethodName" TEXT,
  ADD COLUMN "shippingPrice" DECIMAL(12,2),
  ADD COLUMN "shippingFree" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shippingMinDays" INTEGER,
  ADD COLUMN "shippingMaxDays" INTEGER,
  ADD COLUMN "shippingCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "shippingCarrier" TEXT,
  ADD COLUMN "shippingProvider" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "shippingExternalServiceId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "shippingEstimatedMinDays" INTEGER,
  ADD COLUMN "shippingEstimatedMaxDays" INTEGER,
  ADD COLUMN "shippingCarrier" TEXT,
  ADD COLUMN "shippingProvider" TEXT,
  ADD COLUMN "shippingExternalServiceId" TEXT;
