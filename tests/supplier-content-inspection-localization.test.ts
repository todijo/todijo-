import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "../i18n/config";
import { supplierContentInspectionMessages } from "../i18n/supplier-content-inspection";

test("supplier product-content inspection uses the active locale for all seller-visible copy", () => {
  for (const locale of locales) {
    const copy = supplierContentInspectionMessages(locale);
    for (const value of Object.values(copy)) assert.ok(value.trim(), `${locale} has complete copy`);
    if (locale !== "en") assert.notEqual(copy.title, "Product content review", `${locale} does not leak the English source title`);
  }
  const component = readFileSync(join(process.cwd(), "components/SupplierContentInspection.tsx"), "utf8");
  assert.match(component, /supplierContentInspectionMessages\(locale\)/);
  assert.match(component, /dir="auto"/);
});
