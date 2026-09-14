import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales } from "../i18n/config";
import { feedbackCopy } from "../lib/feedback-copy";

test("missing-page copy and recovery actions exist in every supported locale", () => {
  for (const locale of locales) {
    const copy = feedbackCopy(locale);
    for (const key of ["notFound", "notFoundText", "home", "continueShopping"] as const) {
      assert.ok(copy[key].trim(), `${locale} is missing ${key}`);
    }
  }
  const source = fs.readFileSync(path.join(process.cwd(), "app/not-found.tsx"), "utf8");
  assert.doesNotMatch(source, /adm-barewbar-182203|\/admin(?:\/|\b)/);
});

test("the simplified app icon is referenced by the existing manifest and favicon setup", () => {
  const icon = fs.readFileSync(path.join(process.cwd(), "app/icon.svg"), "utf8");
  assert.match(icon, /#073b2d|#074331|#00291f/);
  assert.doesNotMatch(icon, /#2b0870|#6d28d9/);
  const manifest = fs.readFileSync(path.join(process.cwd(), "app/manifest.ts"), "utf8");
  for (const asset of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-icon.png"]) {
    assert.match(manifest, new RegExp(asset.replace(".", "\\.")));
    assert.ok(fs.existsSync(path.join(process.cwd(), "public", asset)));
  }
});
