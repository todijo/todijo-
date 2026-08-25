-- Nullable by design: existing and never-submitted groups require no backfill.
ALTER TABLE "OrderGroup" ADD COLUMN "transferSubmittedAmountMinor" INTEGER;
