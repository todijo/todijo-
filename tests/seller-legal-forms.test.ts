import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerLegalFormMessages } from "../i18n/seller-legal-forms";
import { franceCompanySubtypes, sellerLegalIdentity } from "../lib/seller-legal-forms";
import { sellerRegistrationRequirements, validBusinessRegistration } from "../lib/seller-registration-requirements";
import { selectSellerOnboardingType } from "../lib/seller-onboarding-seller-type";

const source = (path: string) => readFileSync(path, "utf8");
const professional = (country: string | null, legalForm: unknown, companySubtype: unknown) => sellerLegalIdentity({ sellerType: "PROFESSIONAL", country, legalForm, companySubtype });

test("private sellers have no company form, subtype, or registration requirement", () => {
  assert.deepEqual(sellerLegalIdentity({ sellerType: "PRIVATE", country: "FR", legalForm: null, companySubtype: null }), { identity: { legalForm: "PRIVATE", companySubtype: null }, error: null });
  assert.equal(sellerRegistrationRequirements("FR", "PRIVATE").registrationRequired, false);
  const form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(form, /sellerType === "PROFESSIONAL" && Boolean\(shownAddress\.country\)/);
  assert.match(form, /professionalIdentityReady && <><div className="formField"/);
});

test("professional sellers require country and an allowed top-level legal form", () => {
  assert.equal(professional(null, "COMPANY", null).error, "COUNTRY_REQUIRED");
  assert.equal(professional("FR", null, null).error, "LEGAL_FORM_REQUIRED");
  assert.equal(professional("FR", "FORGED", null).error, "INVALID_LEGAL_FORM");
  assert.equal(professional("FR", "SOLE_TRADER", null).identity?.legalForm, "SOLE_TRADER");
  assert.equal(professional("FR", "COMPANY", "SAS").identity?.legalForm, "COMPANY");
});

test("every approved France company subtype is accepted only for France COMPANY", () => {
  for (const subtype of franceCompanySubtypes) {
    assert.deepEqual(professional("FR", "COMPANY", subtype), { identity: { legalForm: "COMPANY", companySubtype: subtype }, error: null });
    assert.equal(professional("DE", "COMPANY", subtype).error, "INVALID_COMPANY_SUBTYPE");
  }
  assert.equal(professional("FR", "COMPANY", null).error, "COMPANY_SUBTYPE_REQUIRED");
  assert.equal(professional("FR", "COMPANY", "FORGED").error, "INVALID_COMPANY_SUBTYPE");
});

test("generic non-France professional forms never persist French subtypes", () => {
  for (const legalForm of ["SOLE_TRADER", "COMPANY", "ASSOCIATION", "OTHER"] as const) assert.deepEqual(professional("DE", legalForm, null), { identity: { legalForm, companySubtype: null }, error: null });
});

test("private sellers reject forged professional identity fields", () => {
  assert.equal(sellerLegalIdentity({ sellerType: "PRIVATE", country: "FR", legalForm: "COMPANY", companySubtype: null }).error, "INVALID_LEGAL_FORM");
  assert.equal(sellerLegalIdentity({ sellerType: "PRIVATE", country: "FR", legalForm: null, companySubtype: "SAS" }).error, "INVALID_COMPANY_SUBTYPE");
});

test("switching professional to private clears professional identity from the draft payload", () => {
  const professional = { sellerType: "PROFESSIONAL" as const, legalForm: "COMPANY", companySubtype: "SAS" };
  const privateSeller = selectSellerOnboardingType(professional, "PRIVATE");
  assert.deepEqual(privateSeller, { sellerType: "PRIVATE", legalForm: "", companySubtype: "" });

  const draftPayload = { storeName: "Fixture Store", ...privateSeller };
  assert.equal(draftPayload.legalForm, "");
  assert.equal(draftPayload.companySubtype, "");
  assert.deepEqual(sellerLegalIdentity({ sellerType: draftPayload.sellerType, country: "FR", legalForm: draftPayload.legalForm, companySubtype: draftPayload.companySubtype }), {
    identity: { legalForm: "PRIVATE", companySubtype: null }, error: null,
  });
  const privateRequirements = sellerRegistrationRequirements("FR", "PRIVATE");
  assert.equal(validBusinessRegistration("", privateRequirements), true);
  const requiredPrivateFields = { storeName: "Fixture Store", country: "FR", city: "Paris", phone: "+33123456789", address: "1 rue Test", postalCode: "75001", vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE" };
  assert.ok(Object.values(requiredPrivateFields).every(Boolean));
  assert.ok(["REGISTERED", "NOT_REGISTERED_OR_NOT_APPLICABLE"].includes(requiredPrivateFields.vatStatus));
  const route = source("app/api/seller/onboarding/route.ts");
  assert.match(route, /!sellerType \|\| !country \|\| !storeName \|\| !city \|\| !phone \|\| !address \|\| !postalCode \|\| !legal\.identity \|\| !vatStatus/);
  assert.match(route, /!validBusinessRegistration\(registration \?\? "", requirements\)/);

  const switchedBack = selectSellerOnboardingType(privateSeller, "PROFESSIONAL");
  assert.equal(switchedBack.legalForm, "");
  assert.equal(switchedBack.companySubtype, "");
  assert.equal(sellerLegalIdentity({ sellerType: switchedBack.sellerType, country: "FR", legalForm: switchedBack.legalForm, companySubtype: switchedBack.companySubtype }).error, "LEGAL_FORM_REQUIRED");

  const component = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(component, /selectSellerOnboardingType\(\{ sellerType, legalForm, companySubtype \}, "PRIVATE"\)/);
  assert.match(component, /setLegalForm\(next\.legalForm\); setCompanySubtype\(next\.companySubtype\)/);
});

test("draft and store persistence retain nullable subtype without rewriting old COMPANY rows", () => {
  const schema = source("prisma/schema.prisma"), migration = source("prisma/migrations/20261001223000_add_seller_company_subtype/migration.sql"), route = source("app/api/seller/onboarding/route.ts"), page = source("app/seller/onboarding/page.tsx");
  assert.match(schema, /enum SellerCompanySubtype/);
  assert.equal((schema.match(/companySubtype\s+SellerCompanySubtype\?/g) ?? []).length, 3);
  assert.doesNotMatch(migration, /UPDATE|NOT NULL|DEFAULT/);
  assert.match(route, /companySubtype:\s*\(legal\.identity\?\.companySubtype\s*\?\?\s*null\)/);
  assert.match(route, /companySubtype:\s*identity\.companySubtype/);
  assert.match(page, /companySubtype: store\?\.companySubtype \?\? draft\?\.companySubtype \?\? ""/);
});

test("all locales provide the complete progressive legal-form copy", () => {
  const keys = Object.keys(sellerLegalFormMessages.en).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(sellerLegalFormMessages[locale]).sort(), keys);
    for (const value of Object.values(sellerLegalFormMessages[locale])) assert.ok(value.trim());
  }
});

test("Phase 3, Phase 4, Phase 5 and Admin authority remain wired", () => {
  assert.match(source("app/seller/onboarding/SellerAddressOnboardingForm.tsx"), /sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.match(source("app/seller/onboarding/page.tsx"), /defaultBuyerAddress\(prisma, session\.userId\)/);
  assert.match(source("app/seller/onboarding/page.tsx"), /sellerOnboardingDestination/);
  assert.match(source("app/seller/subscription/page.tsx"), /resolveSellerCommercialAccess/);
  assert.match(source("app/api/seller/onboarding/route.ts"), /const store = user\.store\s*\?\s*await tx\.store\.update/);
});
