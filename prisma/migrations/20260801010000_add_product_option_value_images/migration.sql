CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOptionValueImage" (
    "optionValueId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProductOptionValueImage_pkey" PRIMARY KEY ("optionValueId", "imageId")
);

CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");
CREATE INDEX "ProductImage_productId_url_idx" ON "ProductImage"("productId", "url");
CREATE UNIQUE INDEX "ProductOptionValueImage_optionValueId_position_key" ON "ProductOptionValueImage"("optionValueId", "position");
CREATE UNIQUE INDEX "ProductOptionValueImage_one_primary_per_value" ON "ProductOptionValueImage"("optionValueId") WHERE "isPrimary";
CREATE INDEX "ProductOptionValueImage_imageId_idx" ON "ProductOptionValueImage"("imageId");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOptionValueImage" ADD CONSTRAINT "ProductOptionValueImage_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ProductOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOptionValueImage" ADD CONSTRAINT "ProductOptionValueImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "validate_product_option_value_image_product"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ProductOptionValue" value
    JOIN "ProductOption" option ON option."id" = value."optionId"
    JOIN "ProductImage" image ON image."id" = NEW."imageId"
    WHERE value."id" = NEW."optionValueId" AND option."productId" = image."productId"
  ) THEN RAISE EXCEPTION 'Product option value image must belong to the same product'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductOptionValueImage_same_product"
BEFORE INSERT OR UPDATE ON "ProductOptionValueImage"
FOR EACH ROW EXECUTE FUNCTION "validate_product_option_value_image_product"();

INSERT INTO "ProductImage" ("id", "productId", "url", "position")
SELECT md5(p."id" || ':' || image.ordinality::text || ':' || image.url), p."id", image.url, image.ordinality - 1
FROM "Product" p
CROSS JOIN LATERAL unnest(p."images") WITH ORDINALITY AS image(url, ordinality);
