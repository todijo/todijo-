import assert from "node:assert/strict";
import test from "node:test";
import { loyaltyAdminActionMessages, loyaltyAdminAdjustmentKeys, loyaltyAdminAdjustmentMessages,
  loyaltyAdminKeys, loyaltyAdminMessages, loyaltyReconciliationMessages } from "../i18n/loyalty-admin";
import { locales, rtlLocales } from "../i18n/config";
import { loyaltyKeys, loyaltyMessages } from "../i18n/loyalty";
import { loyaltyAccountingKeys, loyaltyAccountingMessages } from "../i18n/loyalty-accounting";

test("buyer and seller loyalty copy has identical nonempty keys in all 14 locales", () => {
  assert.equal(locales.length, 14);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(loyaltyMessages[locale]).sort(), [...loyaltyKeys].sort());
    for (const key of loyaltyKeys) assert.ok(loyaltyMessages[locale][key].trim(), `${locale}:${key}`);
  }
  assert.deepEqual([...rtlLocales].sort(), ["ar", "fa", "ku"].sort());
});

test("admin loyalty copy has identical nonempty keys in all 14 locales", () => {
  for (const locale of locales) {
    assert.deepEqual(Object.keys(loyaltyAdminMessages[locale]).sort(), [...loyaltyAdminKeys].sort());
    for (const key of loyaltyAdminKeys) assert.ok(loyaltyAdminMessages[locale][key].trim(), `${locale}:${key}`);
    assert.deepEqual(Object.keys(loyaltyReconciliationMessages[locale]).sort(),
      ["balanced", "anomaly"].sort());
    assert.ok(loyaltyReconciliationMessages[locale].balanced.trim());
    assert.ok(loyaltyReconciliationMessages[locale].anomaly.trim());
    assert.deepEqual(Object.keys(loyaltyAdminAdjustmentMessages[locale]).sort(),
      [...loyaltyAdminAdjustmentKeys].sort());
    for (const value of Object.values(loyaltyAdminActionMessages[locale])) assert.ok(value.trim());
    for (const key of loyaltyAdminAdjustmentKeys)
      assert.ok(loyaltyAdminAdjustmentMessages[locale][key].trim(), `${locale}:${key}`);
  }
});

test("seller and admin order accounting copy has parity in all 14 locales", () => {
  for (const locale of locales) {
    assert.deepEqual(Object.keys(loyaltyAccountingMessages[locale]).sort(),
      [...loyaltyAccountingKeys].sort());
    for (const key of loyaltyAccountingKeys)
      assert.ok(loyaltyAccountingMessages[locale][key].trim(), `${locale}:${key}`);
  }
});
