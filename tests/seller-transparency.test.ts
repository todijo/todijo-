import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseSellerType, sellerIdentityInput } from "../lib/seller-transparency";

test("seller type requires an explicit professional or private declaration", () => {
  assert.equal(parseSellerType("PROFESSIONAL"), "PROFESSIONAL");
  assert.equal(parseSellerType("PRIVATE"), "PRIVATE");
  assert.equal(parseSellerType("UNKNOWN"), null);
  assert.equal(parseSellerType(undefined), null);
});

test("professional identity is retained while private identity fields are cleared", () => {
  assert.deepEqual(sellerIdentityInput({ legalBusinessName: " Example SARL ", businessRegistrationId: "ABC-1", vatStatus:"REGISTERED", vatNumber: "FR123" }, "PROFESSIONAL"), {
    legalBusinessName: "Example SARL", businessRegistrationId: "ABC-1", businessAddress: null, businessPostalCode: null, vatStatus:"REGISTERED", vatNumber: "FR123",
  });
  assert.deepEqual(sellerIdentityInput({ legalBusinessName: "Must not remain", vatNumber: "FR123" }, "PRIVATE"), {
    legalBusinessName: null, businessRegistrationId: null, businessAddress: null, businessPostalCode: null, vatStatus:"NOT_REGISTERED_OR_NOT_APPLICABLE", vatNumber: null,
  });
  assert.throws(() => sellerIdentityInput({}, "PROFESSIONAL"), /LEGAL_BUSINESS_NAME_REQUIRED/);
});

test("migration is additive and preserves unknown sellers and historical orders", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260809180000_add_seller_type_transparency/migration.sql"), "utf8");
  assert.match(sql, /DEFAULT 'UNKNOWN'/);
  assert.match(sql, /"sellerTypeSnapshot" "SellerType"/);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
});

test("all locales have exact seller-transparency key parity", () => {
  const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"];
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages/seller-transparency/en.json"), "utf8"))).sort();
  for (const locale of locales) {
    const localized = JSON.parse(fs.readFileSync(path.join(process.cwd(), `messages/seller-transparency/${locale}.json`), "utf8"));
    assert.deepEqual(Object.keys(localized).sort(), keys, locale);
  }
});
