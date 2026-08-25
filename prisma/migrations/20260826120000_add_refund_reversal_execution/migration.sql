ALTER TABLE "RefundOperation"
  ADD COLUMN "refundRequestId" TEXT,
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "errorCode" VARCHAR(120),
  ADD COLUMN "errorMessage" VARCHAR(500);

ALTER TABLE "RefundOperation" ADD CONSTRAINT "RefundOperation_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RefundOperation_refundRequestId_key" ON "RefundOperation"("refundRequestId");
CREATE INDEX "RefundOperation_status_nextAttemptAt_idx" ON "RefundOperation"("status", "nextAttemptAt");

ALTER TABLE "TransferReversal"
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "originalStripeTransferId" VARCHAR(255),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "errorCode" VARCHAR(120);

CREATE INDEX "TransferReversal_status_nextAttemptAt_idx" ON "TransferReversal"("status", "nextAttemptAt");
