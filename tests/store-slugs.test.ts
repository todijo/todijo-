import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStoreSlugChangeAt, normalizeStoreSlug, StoreSlugError, validateStoreSlug } from "../lib/store-slugs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("store slugs normalize accents, spacing and case into a bounded canonical format", () => {
  assert.equal(normalizeStoreSlug("  ALN traduction  "), "aln-traduction");
  assert.equal(normalizeStoreSlug("École & Maison"), "ecole-maison");
  assert.equal(validateStoreSlug("  École & Maison "), "ecole-maison");
  assert.throws(() => validateStoreSlug("ab"), (error: unknown) => error instanceof StoreSlugError && error.code === "INVALID_SLUG");
  assert.throws(() => validateStoreSlug("a".repeat(61)), (error: unknown) => error instanceof StoreSlugError && error.code === "INVALID_SLUG");
  assert.throws(() => validateStoreSlug("admin"), (error: unknown) => error instanceof StoreSlugError && error.code === "RESERVED_SLUG");
});

test("the slug cooldown is exactly fourteen UTC calendar days", () => {
  const last = new Date("2026-02-24T18:30:00.000Z");
  assert.equal(nextStoreSlugChangeAt(last).toISOString(), "2026-03-10T18:30:00.000Z");
});

test("store creation uses shared reservation checks and display-name edits do not alter canonical slugs", () => {
  const storeApi = source("app", "api", "store", "route.ts");
  const onboarding = source("app", "api", "seller", "onboarding", "route.ts");
  const adminStores = source("app", "api", "admin", "stores", "route.ts");
  const slugRoute = source("app", "api", "store", "slug", "route.ts");
  const managedStore = source("lib", "admin-access.ts");
  const managedAdditionalStore = source("lib", "admin-managed-store.ts");
  const settingsPage = source("app", "seller", "store-settings", "page.tsx");
  const productPage = source("app", "product", "[id]", "page.tsx");
  const mobileProfile = source("app", "api", "mobile", "account", "profile", "route.ts");
  assert.match(storeApi, /lockStoreSlugNamespace\(tx\)/);
  assert.match(storeApi, /assertStoreSlugAvailable\(tx, slug\)/);
  assert.match(onboarding, /allocateInitialStoreSlug\(tx, storeName, user\.id\)/);
  assert.match(onboarding, /lockStoreSlugNamespace\(tx\)/);
  assert.match(adminStores, /validateStoreSlug\(String\(body\.slug \|\| name\)\)/);
  assert.match(managedStore, /assertStoreSlugAvailable/);
  assert.match(managedStore, /lockStoreSlugNamespace/);
  assert.match(managedAdditionalStore, /assertStoreSlugAvailable/);
  assert.match(managedAdditionalStore, /lockStoreSlugNamespace/);
  assert.match(slugRoute, /requireStoreCapability\(tx, session\.userId, current\.id, "STORE_EDIT_SETTINGS"\)/);
  assert.match(slugRoute, /nextStoreSlugChangeAt\(current\.slugLastChangedAt\)/);
  assert.match(slugRoute, /storeSlugHistory\.create\(\{ data: \{ slug: current\.slug, storeId: current\.id \} \}\)/);
  assert.match(settingsPage, /StoreUrlSettings key=\{storeContext\.selected\.id\}/);
  assert.match(productPage, /href=\{`\/\$\{locale\}\/store\/\$\{product\.store\.slug\}`\}/);
  assert.match(mobileProfile, /store:\{select:\{slug:true\}\}/);
  assert.doesNotMatch(storeApi.slice(storeApi.indexOf("export async function PATCH")), /data:\s*\{[\s\S]{0,250}\bslug\s*:/);
});

test("old slugs resolve straight to the current public slug and unavailable stores get owner-only status", () => {
  const page = source("app", "store", "[slug]", "page.tsx");
  assert.match(page, /storeSlugHistory\.findUnique\(\{ where: \{ slug \}, select: \{ storeId: true \} \}\)/);
  assert.match(page, /permanentRedirect\(`\/\$\{locale\}\/store\/\$\{encodeURIComponent\(publiclyAvailable\.slug\)\}/);
  assert.match(page, /canViewUnavailableStore\(candidate\.id, candidate\.ownerId, candidate\.businessId, session\?\.userId/);
  assert.match(page, /storeOwnerPreviewCard/);
  assert.match(page, /publicStoreAccessWhere\(\)/);
});
