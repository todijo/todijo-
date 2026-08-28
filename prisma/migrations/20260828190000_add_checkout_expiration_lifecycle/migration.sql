ALTER TABLE "Order" ADD COLUMN "checkoutExpiresAt" TIMESTAMP(3),
ADD COLUMN "checkoutExpiredAt" TIMESTAMP(3);

CREATE INDEX "Order_status_checkoutExpiresAt_idx" ON "Order"("status", "checkoutExpiresAt");
CREATE INDEX "Order_checkoutExpiredAt_createdAt_idx" ON "Order"("checkoutExpiredAt", "createdAt");
