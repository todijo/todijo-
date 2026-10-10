import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeSellerAdminContactPhone, persistSellerAdminContactPhone } from "../lib/seller-admin-contact-phone";
import { sellerOnboardingStepCopy } from "../i18n/seller-onboarding-steps";
import { locales } from "../i18n/config";

const source = (path: string) => readFileSync(path, "utf8");

test("admin contact phone normalizes international presentation without inventing a country code", () => {
  assert.equal(normalizeSellerAdminContactPhone(" +33 6 12 34 56 78 "), "+33612345678");
  assert.equal(normalizeSellerAdminContactPhone("0033 (0) 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizeSellerAdminContactPhone("+٩٧١ ٥٠ ١٢٣ ٤٥٦٧"), "+971501234567");
  assert.equal(normalizeSellerAdminContactPhone("06 12 34 56 78"), "0612345678");
});

test("admin contact phone rejects missing, malformed, excessive, and extension-bearing values", () => {
  for (const value of [null, "", "abc1234567", "+0123456789", "+1234567", "+1234567890123456", "0612345678 ext 12", "0".repeat(21)]) {
    assert.equal(normalizeSellerAdminContactPhone(value), null, String(value));
  }
});

test("seller contact phone persistence is idempotent and audits only a non-sensitive change marker", async () => {
  let stored: string | null = null;
  const events: Array<Record<string, unknown>> = [];
  const tx = {
    sellerBusiness: {
      findUnique: async () => ({ adminContactPhone: stored }),
      update: async ({ data }: { data: { adminContactPhone: string } }) => { stored = data.adminContactPhone; return {}; },
    },
    sellerBusinessAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { events.push(data); return {}; } },
  } as never;
  const input = { businessId: "biz-safe", storeId: "store-safe", actorId: "seller-safe", phone: "+33612345678" };
  assert.equal(await persistSellerAdminContactPhone(tx, input), true);
  assert.equal(stored, input.phone);
  assert.equal(await persistSellerAdminContactPhone(tx, input), false);
  assert.equal(events.length, 1);
  const serializedAudit = JSON.stringify(events[0]);
  assert.doesNotMatch(serializedAudit, /\+33612345678/);
  assert.match(serializedAudit, /ADMIN_CONTACT_PHONE_UPDATED/);
});

test("admin phone copy is present in all 14 locales with the approved French and English wording", () => {
  assert.equal(Object.keys(sellerOnboardingStepCopy).length, locales.length);
  for (const locale of locales) {
    assert.ok(sellerOnboardingStepCopy[locale].adminPhoneLabel);
    assert.ok(sellerOnboardingStepCopy[locale].adminPhoneHelp);
  }
  assert.equal(sellerOnboardingStepCopy.fr.adminPhoneLabel, "Téléphone de contact administratif *");
  assert.equal(sellerOnboardingStepCopy.fr.adminPhoneHelp, "Ce numéro est réservé aux communications administratives de Todijo, notamment en cas de problème avec une commande ou d’absence de réponse. Il ne sera pas affiché aux acheteurs.");
  assert.equal(sellerOnboardingStepCopy.en.adminPhoneLabel, "Administrative contact phone *");
  assert.equal(sellerOnboardingStepCopy.en.adminPhoneHelp, "This number is reserved for Todijo administrative communications, including order problems or unanswered messages. It will not be shown to buyers.");
});

test("admin phone remains absent from public store and buyer payloads and admin display is access-audited", () => {
  const publicStoreApi = source("app/api/marketplace/stores/[slug]/route.ts");
  const publicStorePage = source("app/store/[slug]/page.tsx");
  const buyerOrderSerializer = source("lib/mobile-buyer-orders.ts");
  const onboarding = source("app/api/seller/onboarding/route.ts");
  const adminReview = source("app/adm-barewbar-182203/seller-review/page.tsx");
  const adminBenefits = source("app/api/admin/seller-benefits/route.ts");
  assert.doesNotMatch(publicStoreApi, /adminContactPhone/);
  assert.doesNotMatch(publicStorePage, /adminContactPhone/);
  assert.doesNotMatch(buyerOrderSerializer, /adminContactPhone|storeSnapshot/);
  assert.match(onboarding, /body\.adminContactPhone\s*\?\?\s*body\.phone/);
  assert.match(onboarding, /normalizeSellerAdminContactPhone/);
  assert.match(onboarding, /persistSellerAdminContactPhone\(tx/);
  assert.match(adminReview, /ADMIN_CONTACT_PHONE_VIEWED/);
  assert.match(adminReview, /contactPhoneAccessAudited\s*\?/);
  assert.doesNotMatch(adminReview, /console\.(?:log|info|warn|error).*adminContactPhone/);
  assert.match(adminBenefits, /sellerBusiness\.findMany\([\s\S]*?select:\s*\{\s*id:\s*true/);
  assert.match(adminBenefits, /sellerBenefitRequest\.findMany\([\s\S]*?business:\s*\{\s*select:\s*\{\s*owner:/);
  assert.doesNotMatch(adminBenefits, /business:\s*\{\s*include:/);
});

test("admin phone migration is nullable and additive for existing sellers", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source("prisma/migrations/20261011100000_add_seller_admin_contact_phone/migration.sql");
  assert.match(schema, /adminContactPhone\s+String\?\s+@db\.VarChar\(40\)/);
  assert.match(migration, /ALTER TABLE "SellerBusiness"\s+ADD COLUMN "adminContactPhone" VARCHAR\(40\)/);
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE|NOT NULL/i);
});
