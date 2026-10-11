import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales, rtlLocales } from "../i18n/config";
import { getSellerStoreManagementCopy, sellerStoreManagementCopy } from "../i18n/seller-store-management";

const source = (path: string) => readFileSync(path, "utf8");

test("store management copy has complete parity across 14 locales and RTL locales resolve", () => {
  assert.deepEqual(Object.keys(sellerStoreManagementCopy).sort(), [...locales].sort());
  const keys = Object.keys(sellerStoreManagementCopy.en).sort();
  for (const locale of locales) {
    const copy = sellerStoreManagementCopy[locale];
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const value of Object.values(copy)) assert.ok(value.trim(), `${locale} has blank store-management copy`);
  }
  assert.equal(getSellerStoreManagementCopy("fr").primary, "Boutique principale");
  for (const locale of rtlLocales) assert.ok(getSellerStoreManagementCopy(locale).archive.length > 0);
  assert.equal(getSellerStoreManagementCopy("unknown").primary, sellerStoreManagementCopy.en.primary);
});

test("archive UI and endpoint are owner-only, origin-protected, and do not accept a requested destination", () => {
  const dashboard = source("app/dashboard/page.tsx");
  const component = source("components/SellerStoreManagement.tsx");
  const route = source("app/api/seller/stores/[storeId]/archive/route.ts");
  assert.match(dashboard, /user\.role===\"SELLER\"&&selectedPrincipal\?\.owner&&ownedStoreChoices\.length>1/);
  assert.match(component, /method:\"POST\"/);
  assert.match(component, /body:JSON\.stringify\(\{action:\"archive\"\}\)/);
  assert.match(route, /session\.role !== \"SELLER\"/);
  assert.match(route, /isTrustedMutationRequest\(request\)/);
  assert.match(route, /archiveSubordinateStore\(prisma, \{ ownerId: session\.userId, storeId \}\)/);
});

test("archive preserves product rows by moving them to primary and never auto-publishes", () => {
  const archive = source("lib/seller-store-archive.ts");
  assert.match(archive, /input\.storeId === business\.primaryStoreId/);
  assert.match(archive, /SET \"storeId\"=\$\{business\.primaryStoreId\}/);
  assert.match(archive, /product\.\"status\"='PUBLISHED' THEN 'DRAFT'/);
  assert.match(archive, /Serializable/);
  assert.match(archive, /SUBORDINATE_STORE_ARCHIVED/);
  assert.doesNotMatch(archive, /stripeCustomerId|stripeSubscriptionId|stripeAccountId|\.delete\(/);
});
