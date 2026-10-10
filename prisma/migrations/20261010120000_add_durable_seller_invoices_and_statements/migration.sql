CREATE TABLE "SellerBusinessInvoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "amountPaidMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerBusinessInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerMonthlyStatement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contentHash" CHAR(64) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerMonthlyStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerBusinessInvoice_stripeInvoiceId_key" ON "SellerBusinessInvoice"("stripeInvoiceId");
CREATE UNIQUE INDEX "SellerBusinessInvoice_sourceEventId_key" ON "SellerBusinessInvoice"("sourceEventId");
CREATE INDEX "SellerBusinessInvoice_businessId_createdAt_stripeInvoiceId_idx" ON "SellerBusinessInvoice"("businessId", "createdAt", "stripeInvoiceId");
CREATE INDEX "SellerBusinessInvoice_stripeCustomerId_createdAt_idx" ON "SellerBusinessInvoice"("stripeCustomerId", "createdAt");
CREATE INDEX "SellerBusinessInvoice_stripeSubscriptionId_idx" ON "SellerBusinessInvoice"("stripeSubscriptionId");
CREATE UNIQUE INDEX "SellerMonthlyStatement_store_period_currency_revision_key" ON "SellerMonthlyStatement"("storeId", "year", "month", "currency", "revision");
CREATE UNIQUE INDEX "SellerMonthlyStatement_store_period_currency_hash_key" ON "SellerMonthlyStatement"("storeId", "year", "month", "currency", "contentHash");
CREATE INDEX "SellerMonthlyStatement_businessId_year_month_idx" ON "SellerMonthlyStatement"("businessId", "year", "month");
CREATE INDEX "SellerMonthlyStatement_storeId_year_month_idx" ON "SellerMonthlyStatement"("storeId", "year", "month");

ALTER TABLE "SellerBusinessInvoice" ADD CONSTRAINT "SellerBusinessInvoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerMonthlyStatement" ADD CONSTRAINT "SellerMonthlyStatement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerMonthlyStatement" ADD CONSTRAINT "SellerMonthlyStatement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
