-- Add durable server-calculated idempotency for buyer evidence uploads.
ALTER TABLE "RefundEvidence" ADD COLUMN "contentHash" CHAR(64) NOT NULL;

CREATE UNIQUE INDEX "RefundEvidence_refundRequestId_contentHash_key"
ON "RefundEvidence"("refundRequestId", "contentHash");
