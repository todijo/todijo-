CREATE TABLE "PlatformDropshippingPricingSetting" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    "targetMargin" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformDropshippingPricingSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformDropshippingPricingSetting" ("id", "targetMargin", "updatedAt")
VALUES ('GLOBAL', 0.20, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
