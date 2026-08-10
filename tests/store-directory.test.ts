import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const homeSource = readFileSync(join(process.cwd(), "app", "HomeClient.tsx"), "utf8");
const directorySource = readFileSync(join(process.cwd(), "app", "store", "page.tsx"), "utf8");

test("stores-to-discover heading links to the localized store directory", () => {
  assert.match(homeSource, /href=\{`\/\$\{activeLocale\}\/store`\}>\{d\("storesTitle"\)\}/);
});

test("public store directory renders store cards without product cards", () => {
  assert.match(directorySource, /className="featuredStoreCard"/);
  assert.match(directorySource, /_count:\s*\{\s*select:\s*\{\s*products:/);
  assert.doesNotMatch(directorySource, /featuredStoreProducts|\/product\/\$\{product\.id\}/);
});

test("public store directory reuses centralized access eligibility", () => {
  assert.match(directorySource, /publicStoreAccessWhere\(\)/);
  assert.match(directorySource, /where:\s*\{\s*\.\.\.publicStoreAccessWhere\(\),\s*products:\s*\{\s*some:\s*\{\s*status:\s*"PUBLISHED"/);
});

test("every store-directory destination preserves the active locale", () => {
  assert.match(directorySource, /href=\{`\/\$\{locale\}\/store\/\$\{store\.slug\}`\}/);
  assert.doesNotMatch(directorySource, /href=\{`\/store\/\$\{store\.slug\}`\}/);
});
