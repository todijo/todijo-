ALTER TABLE "SupplierProductLink" ADD COLUMN "classificationStatus" VARCHAR(20) NOT NULL DEFAULT 'REVIEWED';
ALTER TABLE "SupplierCatalogImportItem"
  ADD COLUMN "classificationStatus" VARCHAR(40),
  ADD COLUMN "classificationConfidence" DOUBLE PRECISION,
  ADD COLUMN "classificationEvidence" JSONB;
