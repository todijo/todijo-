import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { stripeMinorAmount } from "../lib/currency";

const read = (path: string) => fs.readFileSync(path, "utf8");
const gradle = read("android/app/build.gradle.kts");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const strings = read("android/app/src/main/res/values/strings.xml");
const assetlinks = JSON.parse(read("public/.well-known/assetlinks.json"));
const template = read("android/assetlinks.template.json");

test("Stage 7 release identity and API contract are production-safe", () => {
  assert.match(gradle, /applicationId = "com\.todijo\.marketplace"/);
  assert.match(gradle, /compileSdk = 36/);
  assert.match(gradle, /targetSdk = 36/);
  assert.match(gradle, /minSdk = 23/);
  assert.match(gradle, /versionCode = 1/);
  assert.match(gradle, /versionName = "1\.0\.0"/);
  assert.match(gradle, /isDebuggable = false/);
});

test("release bundle signing fails closed and keeps credentials external", () => {
  for (const name of ["STORE_FILE", "STORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD"]) assert.match(gradle, new RegExp(`TODIJO_UPLOAD_${name}`));
  assert.match(gradle, /it\.name == "bundleRelease"/);
  assert.match(gradle, /check\(releaseSigningConfigured\)/);
  assert.doesNotMatch(gradle, /storePassword\s*=\s*"|keyPassword\s*=\s*"/);
  const ignored = read(".gitignore");
  assert.match(ignored, /\*\.jks/);
  assert.match(ignored, /\*\.keystore/);
});

test("TWA and App Links cover every canonical Todijo HTTPS route", () => {
  assert.match(strings, /https:\/\/todijo\.com\/en\?source=twa/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="todijo\.com"/);
  assert.match(manifest, /android:pathPrefix="\/"/);
  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/);
  assert.doesNotMatch(manifest, /usesCleartextTraffic="true"|android:scheme="http"|WebView/);
});

test("Digital Asset Links remains fail-safe until the real Play certificate exists", () => {
  assert.deepEqual(assetlinks, []);
  assert.match(template, /delegate_permission\/common\.handle_all_urls/);
  assert.match(template, /"package_name": "com\.todijo\.marketplace"/);
  assert.match(template, /REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT/);
  assert.doesNotMatch(template, /(?:[A-F0-9]{2}:){31}[A-F0-9]{2}/);
});

test("protected web commerce, authentication and push boundaries remain intact", () => {
  assert.equal(stripeMinorAmount("9.69", "EUR"), 969);
  const stripe = read("lib/stripe.ts");
  assert.match(stripe, /\/checkout\/success/);
  assert.match(stripe, /\/checkout\/cancel/);
  assert.match(read("app/api/auth/social/[provider]/callback/route.ts"), /stateData\?\.next/);
  assert.match(read("app/product/[id]/page.tsx"), /productSlug/);
  const worker = read("public/sw.js");
  for (const path of ["api", "checkout", "cart", "account", "messages", "notifications"]) assert.match(worker, new RegExp(path));
  assert.match(worker, /PUSH_PATH\.test/);
  assert.doesNotMatch(worker, /value\?\.(?:body|title)/);
});
