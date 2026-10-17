-- Bounded, word-order-independent product discovery for seller entry.
-- The immutable fold function keeps accents equivalent without requiring a
-- database extension, and both GIN indexes contain published records only.
CREATE FUNCTION todijo_catalog_search_fold(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT translate(
    regexp_replace(lower(normalize(value, NFKD)), U&'[\0300-\036F]', '', 'g'),
    'àáâãäåāăąçćčďđèéêëēėęěìíîïīłñńňòóôõöøōŕřśšşťţùúûüūůýÿžźż',
    'aaaaaaaaacccddeeeeeeeeiiiiilnnnooooooorrsssttuuuuuuyyzzz'
  )
$$;

CREATE INDEX "SharedCatalogProduct_published_search_idx"
ON "SharedCatalogProduct"
USING GIN (to_tsvector('simple'::regconfig, todijo_catalog_search_fold("title" || ' ' || coalesce("brand", '') || ' ' || coalesce("modelReference", ''))))
WHERE "status" = 'PUBLISHED';

CREATE INDEX "Product_published_legacy_search_idx"
ON "Product"
USING GIN (to_tsvector('simple'::regconfig, todijo_catalog_search_fold("name")))
WHERE "status" = 'PUBLISHED'
  AND "dataClass" = 'PRODUCTION'
  AND "removedAt" IS NULL
  AND "sharedCatalogProductId" IS NULL;
