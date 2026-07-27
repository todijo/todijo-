-- Finalize the legacy Store logo column after the earlier repair migration
-- has copied its data to the canonical logoUrl column.
DO $$
DECLARE
  has_unpreserved_logo BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Store'
      AND column_name = 'logo'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Store'
        AND column_name = 'logoUrl'
    ) THEN
      RAISE EXCEPTION 'Cannot remove Store.logo because Store.logoUrl does not exist';
    END IF;

    EXECUTE '
      UPDATE "Store"
      SET "logoUrl" = "logo"
      WHERE "logoUrl" IS NULL
        AND "logo" IS NOT NULL
    ';

    EXECUTE '
      SELECT EXISTS (
        SELECT 1
        FROM "Store"
        WHERE "logo" IS NOT NULL
          AND "logoUrl" IS NULL
      )
    ' INTO has_unpreserved_logo;

    IF has_unpreserved_logo THEN
      RAISE EXCEPTION 'Cannot remove Store.logo because one or more values were not preserved in Store.logoUrl';
    END IF;

    EXECUTE 'ALTER TABLE "Store" DROP COLUMN "logo"';
  END IF;
END
$$;
