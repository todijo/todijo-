-- BASIC is pre-launch test state. Preserve billing identities/history; FREE never bills.
UPDATE "SellerSubscription" SET "plan" = 'free' WHERE "plan" = 'basic';
UPDATE "SellerSubscription" SET "scheduledPlan" = 'free' WHERE "scheduledPlan" = 'basic';
UPDATE "StoreAccessGrant" SET "plan" = 'free' WHERE "plan" = 'basic';
UPDATE "SellerSubscriptionChange" SET "sourcePlan" = 'free' WHERE "sourcePlan" = 'basic';
UPDATE "SellerSubscriptionChange" SET "targetPlan" = 'free' WHERE "targetPlan" = 'basic';
UPDATE "SellerSubscriptionReminderDelivery" SET "plan" = 'free' WHERE "plan" = 'basic';

-- A maintained stable publication rank lets every catalog/PDP query enforce FREE
-- capacity immediately at paid expiry, even before the reminder worker runs.
ALTER TABLE "Product" ADD COLUMN "freeVisibilityPosition" INTEGER;
CREATE INDEX "Product_storeId_freeVisibilityPosition_idx" ON "Product"("storeId", "freeVisibilityPosition");
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "storeId" ORDER BY "createdAt", "id")::integer AS position
  FROM "Product" WHERE "status" = 'PUBLISHED' AND "removedAt" IS NULL
)
UPDATE "Product" p SET "freeVisibilityPosition" = ranked.position FROM ranked WHERE p."id" = ranked."id";

CREATE FUNCTION todijo_refresh_free_publication_rank(target_store text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('seller-product-quota:' || target_store, 0));
  WITH ranked AS (
    SELECT "id", row_number() OVER (ORDER BY "createdAt", "id")::integer AS position
    FROM "Product" WHERE "storeId" = target_store AND "status" = 'PUBLISHED' AND "removedAt" IS NULL
  )
  UPDATE "Product" p SET "freeVisibilityPosition" = ranked.position
  FROM ranked WHERE p."id" = ranked."id" AND p."freeVisibilityPosition" IS DISTINCT FROM ranked.position;
  UPDATE "Product" SET "freeVisibilityPosition" = NULL
  WHERE "storeId" = target_store AND ("status" <> 'PUBLISHED' OR "removedAt" IS NOT NULL) AND "freeVisibilityPosition" IS NOT NULL;
END;
$$;
CREATE FUNCTION todijo_product_publication_rank_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM todijo_refresh_free_publication_rank(OLD."storeId");
  ELSIF TG_OP = 'UPDATE' AND OLD."storeId" <> NEW."storeId" THEN
    -- Lock both stores in lexical order if a maintenance operation moves a row.
    PERFORM todijo_refresh_free_publication_rank(LEAST(OLD."storeId", NEW."storeId"));
    PERFORM todijo_refresh_free_publication_rank(GREATEST(OLD."storeId", NEW."storeId"));
  ELSE
    PERFORM todijo_refresh_free_publication_rank(NEW."storeId");
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER todijo_product_publication_rank
AFTER INSERT OR DELETE OR UPDATE OF "status", "storeId", "removedAt" ON "Product"
FOR EACH ROW EXECUTE FUNCTION todijo_product_publication_rank_trigger();
