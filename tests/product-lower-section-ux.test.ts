import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const page = readFileSync(join(root, "app/product/[id]/page.tsx"), "utf8");
const report = readFileSync(join(root, "components/ProductReportButton.tsx"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

test("public product information is filtered and rendered without an accordion", () => {
  assert.match(page, /\.filter\(\(entry\).*Boolean\(entry\[1\]\?\.trim\(\)\)\)/);
  assert.match(page, /hasPublicProductInfo && <section className="productCompliancePublic"/);
  assert.doesNotMatch(page, /<details className="productCompliancePublic"/);
  assert.doesNotMatch(page, /<summary>/);
  assert.match(page, /safetyInformation = product\.safetyInformation\?\.trim\(\)/);
});

test("compact information and action layouts are responsive and RTL-safe", () => {
  assert.match(css, /\.productCompliancePublic dl\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.productComplianceLongText p\{[^}]*white-space:pre-wrap;overflow-wrap:anywhere/);
  assert.match(css, /\.productComplianceLongText\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.productComplianceLongText p\{max-width:68ch;[^}]*word-break:break-word/);
  assert.match(css, /\.productCompliancePublic\{width:min\(1180px,calc\(100% - 24px\)\);margin:20px auto 0\}/);
  assert.match(css, /@media\(max-width:900px\)\{\.productComplianceLongText\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:640px\)[\s\S]*\.productCompliancePublic dl\{grid-template-columns:1fr\}/);
  assert.match(css, /\.productLowerActions\{[^}]*flex-wrap:wrap/);
  assert.match(page, /productLowerActions/);
});

test("reporting uses one accessible dialog and preserves endpoint semantics", () => {
  assert.match(report, /role="dialog" aria-modal="true"/);
  assert.match(report, /event\.key === "Escape"/);
  assert.match(report, /const trigger = triggerRef\.current/);
  assert.match(report, /trigger\?\.focus\(\)/);
  assert.match(report, /submittingRef\.current \|\| busy/);
  assert.match(report, /fetch\(`\/api\/products\/\$\{productId\}\/report`/);
  for (const reason of ["ILLEGAL", "UNSAFE", "COUNTERFEIT", "INTELLECTUAL_PROPERTY", "MISLEADING", "PROHIBITED", "OTHER"]) assert.match(report, new RegExp(`value="${reason}"`));
  assert.match(report, /minLength=\{10\} maxLength=\{1500\}/);
});

test("report dialog translations have parity in all locales", () => {
  const directory = join(root, "messages/report-dialog");
  const files = readdirSync(directory).filter((file) => file.endsWith(".json")).sort();
  assert.equal(files.length, 14);
  for (const file of files) assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(directory, file), "utf8"))).sort(), ["help"]);
});
