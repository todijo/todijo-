ALTER TABLE "SellerBusiness"
ADD COLUMN "firstPaidTrialGrantedAt" TIMESTAMP(3);

ALTER TABLE "SellerSubscription"
ADD COLUMN "trialEnd" TIMESTAMP(3);

-- A seller who already had a Stripe-backed PLUS/PRO subscription has already
-- used their first paid-subscription opportunity; do not offer the one-time
-- trial again after this migration.
UPDATE "SellerBusiness" AS business
SET "firstPaidTrialGrantedAt" = history."firstPaidAt"
FROM (
    SELECT store."businessId",
           MIN(COALESCE(subscription."currentPeriodStart", subscription."createdAt")) AS "firstPaidAt"
    FROM "Store" AS store
    INNER JOIN "SellerSubscription" AS subscription ON subscription."storeId" = store."id"
    WHERE store."businessId" IS NOT NULL
      AND subscription."stripeSubscriptionId" IS NOT NULL
      AND LOWER(subscription."plan") IN ('plus', 'pro')
    GROUP BY store."businessId"
) AS history
WHERE business."id" = history."businessId"
  AND business."firstPaidTrialGrantedAt" IS NULL;
