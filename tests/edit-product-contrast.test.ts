import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("edit-product compliance light surfaces have explicit readable foregrounds", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  assert.match(css, /\.sellerEditProductForm \.productComplianceFields input,[^{]+textarea\{[^}]*background:#fff[^}]*color:#173b30/);
  assert.match(css, /\.sellerEditProductForm \.productComplianceFields>p\{color:#526b62\}/);
  assert.match(css, /\.sellerEditProductForm \.listingDeclaration\{[^}]*background:#eff9f4[^}]*color:#173b30/);
  assert.match(css, /\.sellerEditProductForm \.listingDeclaration input\{[^}]*width:20px[^}]*accent-color:#087653/);
  assert.match(css, /\.sellerEditProductForm input::placeholder,[^{]+textarea::placeholder\{color:#60746c;opacity:1\}/);
});

test("contrast fix stays scoped to the edit-product form", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const start = css.indexOf("/* Explicit light-surface foregrounds for the edit-product form. */");
  const end = css.indexOf("/* End edit-product light-surface foregrounds. */");
  const addition = css.slice(start, end);
  for (const rule of addition.split("}")) {
    if (!rule.includes("{")) continue;
    const selector = rule.split("{")[0].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    assert.ok(selector.split(",").every((part) => part.trim().startsWith(".sellerEditProductForm")), selector);
  }
});
