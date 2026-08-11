-- Close the rolling-deployment window for writes made by the previous
-- platform-only application after tenant-scoped identities are installed.

-- Catch any platform writes that landed between the preceding migration and
-- this guard. Seller rows are never reclassified as platform rows.
UPDATE "SupplierProductLink"
SET "connectionId" = 'platform-cj'
WHERE "ownerType" = 'PLATFORM' AND "connectionId" IS NULL;

-- A variant inherits only the connection already attached to its own product's
-- supplier link. This cannot select another product, seller, or global default.
UPDATE "ProductVariant" AS variant
SET "supplierConnectionId" = link."connectionId"
FROM "SupplierProductLink" AS link
WHERE link."productId" = variant."productId"
  AND link."connectionId" IS NOT NULL
  AND variant."supplierVariantId" IS NOT NULL
  AND variant."supplierConnectionId" IS NULL;

CREATE FUNCTION "guard_legacy_supplier_product_connection"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."ownerType" = 'PLATFORM' AND NEW."connectionId" IS NULL THEN
    NEW."connectionId" := 'platform-cj';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SupplierProductLink_legacy_connection_guard"
BEFORE INSERT OR UPDATE OF "ownerType", "connectionId"
ON "SupplierProductLink"
FOR EACH ROW
EXECUTE FUNCTION "guard_legacy_supplier_product_connection"();

CREATE FUNCTION "guard_legacy_supplier_variant_connection"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."supplierVariantId" IS NOT NULL AND NEW."supplierConnectionId" IS NULL THEN
    SELECT link."connectionId"
      INTO NEW."supplierConnectionId"
      FROM "SupplierProductLink" AS link
     WHERE link."productId" = NEW."productId";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProductVariant_legacy_connection_guard"
BEFORE INSERT OR UPDATE OF "productId", "supplierVariantId", "supplierConnectionId"
ON "ProductVariant"
FOR EACH ROW
EXECUTE FUNCTION "guard_legacy_supplier_variant_connection"();
