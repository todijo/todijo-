-- Existing sellers remain UNKNOWN until they explicitly confirm their legal status.
CREATE TYPE "SellerType" AS ENUM ('UNKNOWN', 'PROFESSIONAL', 'PRIVATE');

ALTER TABLE "Store"
  ADD COLUMN "sellerType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "legalBusinessName" TEXT,
  ADD COLUMN "businessRegistrationId" TEXT,
  ADD COLUMN "businessAddress" TEXT,
  ADD COLUMN "businessPostalCode" TEXT,
  ADD COLUMN "vatNumber" TEXT;

-- Nullable preserves older orders; new checkouts capture the current declared status.
ALTER TABLE "Order" ADD COLUMN "sellerTypeSnapshot" "SellerType";
