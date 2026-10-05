import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "../lib/sirene-identifiers";
import { hasVerifiedFrenchBusiness, isFrenchProfessional, publicStoreCity } from "../lib/seller-business-verification-policy";
import { evaluateSireneSnapshot, isTransientSireneFailure } from "../lib/seller-business-verification";
import { InseeSireneV311 } from "../lib/insee-sirene-v311";
import { sellerBusinessVerificationMessage } from "../lib/seller-dashboard-readiness";

test("French identifiers normalize whitespace, validate checksums, and preserve SIREN/SIRET relation", () => {
  assert.deepEqual(normalizeSiren("732 829 320"), { ok: true, value: "732829320" });
  assert.deepEqual(normalizeSiret("732 829 320 00074"), { ok: true, value: "73282932000074" });
  assert.deepEqual(normalizeSiren("73282932"), { ok: false, code: "SIREN_INVALID_FORMAT" });
  assert.deepEqual(normalizeSiren("0732829320"), { ok: false, code: "SIREN_INVALID_FORMAT" });
  assert.deepEqual(normalizeSiren("732829321"), { ok: false, code: "SIREN_INVALID_CHECKSUM" });
  assert.deepEqual(normalizeSiren(" 732\t829\n320 "), { ok: true, value: "732829320" });
  assert.deepEqual(normalizeSiret("7328293200007"), { ok: false, code: "SIRET_INVALID_FORMAT" });
  assert.deepEqual(normalizeSiret("073282932000074"), { ok: false, code: "SIRET_INVALID_FORMAT" });
  assert.deepEqual(normalizeSiret("73282932000075"), { ok: false, code: "SIRET_INVALID_CHECKSUM" });
  assert.deepEqual(normalizeSiret("73282932000074"), { ok: true, value: "73282932000074" });
  assert.equal(sirenForSiret("73282932000074"), "732829320");
});

test("INSEE V3.11 adapter sends the API key only as a server header and maps public identifiers", async () => {
  let seenUrl = "";
  let seenKey = "";
  const client = new InseeSireneV311("test-secret-never-returned", async (input, init) => {
    seenUrl = String(input);
    seenKey = new Headers(init?.headers).get("X-INSEE-Api-Key-Integration") ?? "";
    return Response.json({ uniteLegale: { siren: "732829320", etatAdministratifUniteLegale: "A", denominationUniteLegale: "Example SAS", statutDiffusionUniteLegale: "O" } });
  });
  const result = await client.lookupLegalUnit("732829320");
  assert.equal(seenUrl, "https://api.insee.fr/api-sirene/3.11/siren/732829320");
  assert.equal(seenKey, "test-secret-never-returned");
  assert.deepEqual(result, { ok: true, value: { siren: "732829320", status: "A", name: "Example SAS", diffusionRestricted: false } });
  assert.equal(JSON.stringify(result).includes(seenKey), false);
});

test("INSEE adapter distinguishes missing records, rate limiting, retries, and timeouts", async () => {
  const missing = await new InseeSireneV311("key", async () => new Response(null, { status: 404 })).lookupLegalUnit("732829320");
  assert.deepEqual(missing, { ok: false, reason: "NOT_FOUND" });
  const limited = await new InseeSireneV311("key", async () => new Response(null, { status: 429, headers: { "Retry-After": "3" } })).lookupLegalUnit("732829320");
  assert.deepEqual(limited, { ok: false, reason: "RATE_LIMITED", retryAfterMs: 3000 });
  let attempts = 0;
  const retried = await new InseeSireneV311("key", async () => ++attempts === 1 ? new Response(null, { status: 503 }) : Response.json({ uniteLegale: { siren: "732829320", etatAdministratifUniteLegale: "A" } })).lookupLegalUnit("732829320");
  assert.equal(attempts, 2);
  assert.equal(retried.ok, true);
  const timeout = await new InseeSireneV311("key", async () => { const error = new Error("timed out"); error.name = "TimeoutError"; throw error; }).lookupLegalUnit("732829320");
  assert.deepEqual(timeout, { ok: false, reason: "TIMEOUT", retryAfterMs: 60000 });
});

test("verification accepts only active matching SIREN/SIRET data and routes incomplete public data to review", () => {
  const legalUnit = { siren: "732829320", status: "A", name: "Example SAS", diffusionRestricted: false };
  const establishment = { siret: "73282932000074", siren: "732829320", status: "A", name: "Example SAS", address: "10 Rue Exemple", postalCode: "75001", city: "Paris", diffusionRestricted: false };
  assert.deepEqual(evaluateSireneSnapshot({ legalUnit, establishment, siren: "732829320", siret: "73282932000074" }), { state: "VERIFIED", code: "VERIFIED" });
  assert.deepEqual(evaluateSireneSnapshot({ legalUnit, establishment: { ...establishment, siren: "123456789" }, siren: "732829320", siret: "73282932000074" }), { state: "REJECTED", code: "SIRET_SIREN_MISMATCH" });
  assert.deepEqual(evaluateSireneSnapshot({ legalUnit: { ...legalUnit, diffusionRestricted: true, name: null }, establishment, siren: "732829320", siret: "73282932000074" }), { state: "MANUAL_REVIEW", code: "PUBLIC_DATA_INCOMPLETE" });
});

test("transient INSEE failures remain retryable without treating definitive 404 as an outage", () => {
  for (const reason of ["RATE_LIMITED", "TIMEOUT", "UPSTREAM_ERROR", "NOT_CONFIGURED", "INVALID_RESPONSE"]) assert.equal(isTransientSireneFailure(reason), true);
  assert.equal(isTransientSireneFailure("NOT_FOUND"), false);
});

test("seller dashboard readiness distinguishes INSEE outcomes from pending and transient states", () => {
  assert.equal(sellerBusinessVerificationMessage({businessState:"REJECTED",businessReason:"NOT_FOUND",establishmentState:"REJECTED",establishmentReason:"NOT_FOUND"}),"notFound");
  assert.equal(sellerBusinessVerificationMessage({businessState:"REJECTED",businessReason:"SIRET_SIREN_MISMATCH",establishmentState:"REJECTED",establishmentReason:"SIRET_SIREN_MISMATCH"}),"mismatch");
  assert.equal(sellerBusinessVerificationMessage({businessState:"MANUAL_REVIEW",businessReason:"PUBLIC_DATA_INCOMPLETE",establishmentState:"MANUAL_REVIEW",establishmentReason:"PUBLIC_DATA_INCOMPLETE"}),"partialData");
  assert.equal(sellerBusinessVerificationMessage({businessState:"MANUAL_REVIEW",businessReason:"INACTIVE_OR_CLOSED",establishmentState:"MANUAL_REVIEW"}),"manualReview");
  assert.equal(sellerBusinessVerificationMessage({businessState:"PENDING",businessReason:"TIMEOUT",establishmentState:"PENDING",establishmentReason:"TIMEOUT"}),"unavailable");
  assert.equal(sellerBusinessVerificationMessage({businessState:"NOT_STARTED"}),"dashboardPending");
});

test("French professional publishing requires a verified establishment linked to the current SIRET", () => {
  assert.equal(isFrenchProfessional("PROFESSIONAL", "France"), true);
  assert.equal(isFrenchProfessional("PRIVATE", "FR"), false);
  const identity = { sellerType: "PROFESSIONAL", country: "FR", businessRegistrationId: "73282932000074", business: { siren: "732829320", inseeVerificationState: "VERIFIED" }, establishment: { siret: "73282932000074", legalUnitSiren: "732829320", verificationState: "VERIFIED" } };
  assert.equal(hasVerifiedFrenchBusiness(identity), true);
  assert.equal(hasVerifiedFrenchBusiness({ ...identity, businessRegistrationId: "73282932000082" }), false);
  assert.equal(hasVerifiedFrenchBusiness({ ...identity, establishment: { ...identity.establishment, verificationState: "MANUAL_REVIEW" } }), false);
  assert.equal(hasVerifiedFrenchBusiness({ sellerType: "PRIVATE", country: "FR" }), true);
  assert.equal(hasVerifiedFrenchBusiness({ sellerType: "PROFESSIONAL", country: "DE" }), true);
});

test("public city privacy applies only to French professionals who opt out", () => {
  assert.equal(publicStoreCity({ sellerType: "PROFESSIONAL", country: "FR", displayBusinessAddress: false, city: "Paris" }), "");
  assert.equal(publicStoreCity({ sellerType: "PROFESSIONAL", country: "France", displayBusinessAddress: true, city: "Paris" }), "Paris");
  assert.equal(publicStoreCity({ sellerType: "PROFESSIONAL", country: "DE", displayBusinessAddress: false, city: "Berlin" }), "Berlin");
  assert.equal(publicStoreCity({ sellerType: "PRIVATE", country: "FR", displayBusinessAddress: false, city: "Lyon" }), "Lyon");
});

test("verification writes are origin-protected, server-owned, and public French access is verification-gated", () => {
  const route = readFileSync("app/api/seller/business/verification/route.ts", "utf8");
  const publish = readFileSync("lib/seller-subscription.ts", "utf8");
  const access = readFileSync("lib/admin-access.ts", "utf8");
  assert.match(route, /isTrustedMutationRequest\(request\)/);
  assert.match(route, /session\.role === "ADMIN"/);
  assert.match(route, /verifySellerBusinessIdentifiers\(prisma/);
  assert.doesNotMatch(route, /body\.(?:state|verifiedAt|verificationSource)\s*[,=]/);
  assert.match(publish, /hasVerifiedFrenchBusiness\(store\)/);
  assert.match(access, /inseeVerificationState: "VERIFIED"/);
  assert.match(access, /establishment: \{ is: \{ verificationState: "VERIFIED" \} \}/);
});

test("existing professional sellers can submit editable SIREN/SIRET values from store settings and retain verified establishment linkage", () => {
  const form = readFileSync("app/seller/store-settings/StoreSettingsForm.tsx", "utf8");
  const route = readFileSync("app/api/store/route.ts", "utf8");
  assert.match(form, /name="businessSiren"[^>]*defaultValue=\{initialValues\.businessSiren\}/);
  assert.match(form, /name="businessRegistrationId"[^>]*defaultValue=\{initialValues\.businessRegistrationId\}/);
  assert.match(form, /businessSiren:values\.get\("businessSiren"\),businessRegistrationNumber:values\.get\("businessRegistrationId"\)/);
  assert.match(route, /verifiedEstablishment\?\.verificationState==="VERIFIED"&&verifiedEstablishment\.legalUnitSiren===siren\.value/);
  assert.match(route, /\?\{establishmentId\}:\{\}/);
});

test("corrected identifiers clear stale errors and preserve separate length, checksum, not-found, and outage messages", () => {
  const onboarding = readFileSync("app/seller/onboarding/SellerAddressOnboardingForm.tsx", "utf8");
  const settings = readFileSync("app/seller/store-settings/StoreSettingsForm.tsx", "utf8");
  const french = JSON.parse(readFileSync("messages/seller-business-verification/fr.json", "utf8")) as Record<string, string>;
  assert.match(onboarding, /setBusinessSiren\(event\.target\.value\); setVerificationMessage\(""\)/);
  assert.match(onboarding, /setBusinessRegistrationNumber\(event\.target\.value\); setVerificationMessage\(""\)/);
  assert.match(settings, /onChange=\{\(\)=>setVerificationMessage\(""\)\}/);
  assert.match(onboarding, /SIREN_INVALID_FORMAT[^;]*invalidSiren/);
  assert.match(onboarding, /SIRET_INVALID_FORMAT[^;]*invalidSiret/);
  assert.match(onboarding, /SIREN_INVALID_CHECKSUM[^;]*invalidSirenChecksum/);
  assert.match(onboarding, /SIRET_INVALID_CHECKSUM[^;]*invalidSiretChecksum/);
  assert.equal(french.invalidSiren, "Le SIREN doit comporter 9 chiffres.");
  assert.equal(french.invalidSiret, "Le SIRET doit comporter 14 chiffres.");
  assert.equal(french.invalidSirenChecksum, "Le SIREN comporte 9 chiffres, mais sa clé de contrôle est invalide.");
  assert.equal(french.invalidSiretChecksum, "Le SIRET comporte 14 chiffres, mais sa clé de contrôle est invalide.");
  assert.match(onboarding, /code === "NOT_FOUND" \? "notFound"/);
  assert.match(onboarding, /"RATE_LIMITED", "UPSTREAM_ERROR"/);
});

test("Admin approval accepts only a matching verified/manual-review pair and keeps an audit trail", () => {
  const review = readFileSync("lib/seller-onboarding-review.ts", "utf8");
  assert.match(review, /SELLER_BUSINESS_VERIFICATION_REQUIRED/);
  assert.match(review, /store\.business\?\.inseeVerificationState==="VERIFIED"&&establishment\.verificationState==="VERIFIED"/);
  assert.match(review, /store\.business\?\.inseeVerificationState==="MANUAL_REVIEW"\|\|store\.business\?\.inseeVerificationState==="VERIFIED"\)\&\&establishment\.verificationState==="MANUAL_REVIEW"/);
  assert.match(review, /INSEE_ADMIN_MANUAL_VERIFIED/);
  assert.match(review, /appendSellerBusinessAudit/);
  assert.match(review, /updatedAt:store\.updatedAt/);
});

test("successful verification links only the owner's existing store with the exact SIRET", () => {
  const service = readFileSync("lib/seller-business-verification.ts", "utf8");
  assert.match(service, /if \(verified\) \{\s*await tx\.store\.updateMany\(/);
  assert.match(service, /ownerId: business\.ownerId, businessId: business\.id, businessRegistrationId: siret/);
  assert.match(service, /data: \{ establishmentId: pendingEstablishment\.id \}/);
});

test("storefront and web/mobile public payloads honor the country-only location preference", () => {
  const webStore = readFileSync("app/store/[slug]/page.tsx", "utf8");
  const productPage = readFileSync("app/product/[id]/page.tsx", "utf8");
  const mobileStore = readFileSync("app/api/marketplace/stores/[slug]/route.ts", "utf8");
  const mobileProduct = readFileSync("app/api/marketplace/products/[id]/route.ts", "utf8");
  const home = readFileSync("app/api/marketplace/home/route.ts", "utf8");
  assert.match(webStore, /publicStoreLocation\(store\)/);
  assert.match(productPage, /publicStoreCity\(product\.store\)/);
  for (const source of [mobileStore, mobileProduct, home]) assert.match(source, /displayBusinessAddress/);
  for (const source of [mobileStore, mobileProduct, home]) assert.doesNotMatch(source, /contactEmail|phone:\s*store\.phone|businessAddress/);
});

test("seller verification schema and migration are additive with scoped establishment identity", () => {
  const migration = readFileSync("prisma/migrations/20261004160000_add_seller_business_verification/migration.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /enum SellerBusinessVerificationState/);
  assert.match(schema, /model SellerBusinessEstablishment/);
  assert.match(schema, /@@unique\(\[businessId, siret\]\)/);
  assert.match(migration, /CREATE TABLE "SellerBusinessEstablishment"/);
  assert.match(migration, /FOREIGN KEY \("establishmentId", "businessId"\)/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE "(?:User|Store|SellerBusiness)")\b/i);
});

test("French and English approved verification copy has identical keys", () => {
  const fr = JSON.parse(readFileSync("messages/seller-business-verification/fr.json", "utf8")) as Record<string, string>;
  const en = JSON.parse(readFileSync("messages/seller-business-verification/en.json", "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  assert.equal(fr.professionalTitle, "Professionnel / commerçant");
  assert.equal(fr.privateTitle, "Particulier / non-professionnel");
  assert.equal(en.verify, "Verify my business");
  const requestConfig = readFileSync("i18n/request.ts", "utf8");
  assert.match(requestConfig, /messages\.SellerBusinessVerification[\s\S]*locale === "fr" \? "fr" : "en"/);
});
