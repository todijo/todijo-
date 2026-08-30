import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(join(process.cwd(), "prisma", "migrations", "20260830180000_add_catalog_translation_job_queue", "migration.sql"), "utf8");

test("translation queue schema keeps content authoritative in product metadata", () => {
  assert.match(schema, /model CatalogTranslationJob \{/);
  assert.match(schema, /model CatalogTranslationItem \{/);
  assert.match(schema, /model CatalogTranslationAttempt \{/);
  assert.match(schema, /model CatalogTranslationBudget \{/);
  assert.doesNotMatch(schema, /model CatalogTranslationItem \{[\s\S]*?translatedTitle/);
  assert.doesNotMatch(schema, /model CatalogTranslationItem \{[\s\S]*?translatedDescription/);
});

test("translation work has a global billable-work idempotency invariant", () => {
  assert.match(schema, /@@unique\(\[productId, sourceFingerprint, sourceLocale, targetLocale, provider, providerVersion, pipelineVersion\], map: "CatalogTranslationItem_idempotency_key"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "CatalogTranslationItem_idempotency_key"[\s\S]*?"productId", "sourceFingerprint", "sourceLocale", "targetLocale", "provider", "providerVersion", "pipelineVersion"/);
  assert.match(schema, /providerRequestKey\s+String\s+@unique/);
  assert.match(schema, /@@unique\(\[itemId, attemptNumber\]\)/);
});

test("translation queue persists finite-retry leases and manual intervention states", () => {
  assert.match(schema, /enum CatalogTranslationItemStatus \{[\s\S]*?CLAIMED[\s\S]*?RETRYABLE[\s\S]*?MANUAL_ACTION_REQUIRED/);
  for (const field of ["attemptCount", "nextAttemptAt", "claimToken", "claimedAt", "leaseExpiresAt"]) assert.match(schema, new RegExp(`\\b${field}\\b`));
  assert.match(schema, /enum CatalogTranslationAttemptStatus \{[\s\S]*?RESERVED[\s\S]*?SUBMITTED[\s\S]*?AMBIGUOUS/);
});

test("daily and monthly budget rows account for reserved submitted and completed characters", () => {
  assert.match(schema, /enum CatalogTranslationBudgetPeriod \{\s+DAY\s+MONTH\s+\}/);
  assert.match(schema, /model CatalogTranslationBudget \{[\s\S]*?limitCharacters\s+BigInt[\s\S]*?reservedCharacters\s+BigInt[\s\S]*?submittedCharacters\s+BigInt[\s\S]*?completedCharacters\s+BigInt/);
  assert.match(schema, /@@unique\(\[provider, periodType, periodStart\]\)/);
});

test("migration is additive and preserves queue audit evidence", () => {
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /ALTER TABLE "Product"|ALTER TABLE "SupplierProductLink"/);
});
