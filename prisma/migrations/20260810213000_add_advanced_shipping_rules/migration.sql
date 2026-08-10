ALTER TABLE "Store"
  ADD COLUMN "shippingWorldwide" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shippingPostalCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "shippingFreeThreshold" DECIMAL(12,2);

ALTER TABLE "Product"
  ADD COLUMN "shippingOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shippingEnabled" BOOLEAN,
  ADD COLUMN "shippingMethodName" TEXT,
  ADD COLUMN "shippingPrice" DECIMAL(12,2),
  ADD COLUMN "shippingFree" BOOLEAN,
  ADD COLUMN "shippingFreeThreshold" DECIMAL(12,2),
  ADD COLUMN "shippingMinDays" INTEGER,
  ADD COLUMN "shippingMaxDays" INTEGER,
  ADD COLUMN "shippingCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "shippingWorldwide" BOOLEAN,
  ADD COLUMN "shippingPostalCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "shippingCarrier" TEXT,
  ADD COLUMN "shippingProvider" TEXT,
  ADD COLUMN "shippingExternalServiceId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "shippingPolicySnapshot" JSONB;
