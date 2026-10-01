CREATE TYPE "SellerCompanySubtype" AS ENUM (
  'SAS',
  'SASU',
  'SARL',
  'EURL',
  'SA',
  'SNC',
  'SCS',
  'SCA',
  'SOCIETE_CIVILE',
  'SOCIETE_EXERCICE_LIBERAL',
  'SOCIETE_COOPERATIVE',
  'SOCIETE_EUROPEENNE',
  'OTHER_COMPANY'
);

ALTER TABLE "SellerOnboardingDraft"
  ADD COLUMN "companySubtype" "SellerCompanySubtype";

ALTER TABLE "Store"
  ADD COLUMN "companySubtype" "SellerCompanySubtype";
