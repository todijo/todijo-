CREATE TABLE "BuyerShippingAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientName" VARCHAR(160) NOT NULL,
    "addressLine1" VARCHAR(240) NOT NULL,
    "addressLine2" VARCHAR(240),
    "postalCode" VARCHAR(32) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "state" VARCHAR(120),
    "phone" VARCHAR(40),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuyerShippingAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyerShippingAddress_userId_isDefault_createdAt_idx"
ON "BuyerShippingAddress"("userId", "isDefault", "createdAt");

CREATE UNIQUE INDEX "BuyerShippingAddress_one_default_per_user_idx"
ON "BuyerShippingAddress"("userId") WHERE "isDefault" = true;

ALTER TABLE "BuyerShippingAddress"
ADD CONSTRAINT "BuyerShippingAddress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
