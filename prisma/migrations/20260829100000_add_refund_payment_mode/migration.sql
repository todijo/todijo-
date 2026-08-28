ALTER TABLE "Order" ADD COLUMN "stripePaymentMode" VARCHAR(4);
ALTER TABLE "RefundOperation" ADD COLUMN "paymentMode" VARCHAR(4);

UPDATE "Order"
SET "stripePaymentMode" = CASE
  WHEN "stripeCheckoutSessionId" LIKE 'cs_test_%' THEN 'TEST'
  WHEN "stripeCheckoutSessionId" LIKE 'cs_live_%' THEN 'LIVE'
  ELSE NULL
END
WHERE "stripePaymentMode" IS NULL;

UPDATE "RefundOperation" r
SET "paymentMode" = o."stripePaymentMode"
FROM "Order" o
WHERE r."orderId" = o.id AND r."paymentMode" IS NULL;
