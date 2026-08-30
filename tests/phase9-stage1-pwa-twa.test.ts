import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");
const manifest = read("app/manifest.ts");
const layout = read("app/layout.tsx");
const registration = read("components/ServiceWorkerRegistration.tsx");
const worker = read("public/sw.js");
const offline = read("app/offline/page.tsx");
const androidBuild = read("android/app/build.gradle.kts");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const androidStrings = read("android/app/src/main/res/values/strings.xml");
const assetlinks = JSON.parse(read("public/.well-known/assetlinks.json"));
const assetlinksTemplate = read("android/assetlinks.template.json");

test("manifest is scoped, standalone, branded and installable", () => {
  for (const contract of ['id: "/"', 'start_url: "/?source=pwa"', 'scope: "/"', 'display: "standalone"', 'purpose: "maskable"', 'theme_color: "#16074c"']) assert.ok(manifest.includes(contract), contract);
});

test("production service worker registration is scope-bound and bypasses HTTP cache", () => {
  assert.match(layout, /<ServiceWorkerRegistration\/>/);
  assert.match(registration, /process\.env\.NODE_ENV !== "production"/);
  assert.match(registration, /register\("\/sw\.js", \{ scope: "\/", updateViaCache: "none" \}\)/);
});

test("service worker versions caches and removes obsolete caches", () => {
  assert.match(worker, /CACHE_VERSION = "phase9-stage1-v1"/);
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(worker, /caches\.delete\(key\)/);
  assert.doesNotMatch(worker, /skipWaiting/);
});

test("service worker bypasses sensitive commerce and private routes", () => {
  const literal = worker.match(/const SENSITIVE_PATH = (\/\^.*\/i);/)?.[1];
  assert.ok(literal);
  const sensitive = Function('"use strict"; return (' + literal + ");")() as RegExp;
  const paths = ["/api/auth/session", "/api/account/addresses", "/api/checkout", "/api/products", "/api/admin/users", "/api/seller/orders/1", "/checkout", "/en/checkout/success", "/account/orders", "/en/account/orders/1", "/cart", "/messages/1", "/seller/orders", "/adm-barewbar-182203", "/login", "/connect/success"];
  for (const path of paths) assert.equal(sensitive.test(path.replace(/^\/(?:en|fr|ar)(?=\/)/, "")), true, path);
  assert.match(worker, /function isSensitivePath/);
  assert.match(worker, /isSensitivePath\(url\.pathname\)\) return/);
  assert.doesNotMatch(worker, /cache\.put\(request[\s\S]*request\.mode === "navigate"/);
});

test("offline shell is localized and explicitly non-authoritative", () => {
  for (const path of ["/en/offline", "/fr/offline", "/ar/offline"]) assert.ok(worker.includes(path));
  assert.match(offline, /You’re offline/);
  assert.match(offline, /Vous êtes hors ligne/);
  assert.match(offline, /أنت غير متصل/);
  assert.match(offline, /rtlLocales\.has\(locale\)/);
  assert.match(offline, /copy\[locale as keyof typeof copy\] \?\? copy\.en/);
});

test("TWA uses production package, API 36 and only the Todijo origin", () => {
  assert.match(androidBuild, /applicationId = "com\.todijo\.marketplace"/);
  assert.match(androidBuild, /compileSdk = 36/);
  assert.match(androidBuild, /targetSdk = 36/);
  assert.match(androidStrings, /https:\/\/todijo\.com\/en\?source=twa/);
  assert.match(androidManifest, /android:autoVerify="true"/);
  assert.match(androidManifest, /android:host="todijo\.com"/);
  for (const external of ["stripe.com", "accounts.google.com", "facebook.com", "appleid.apple.com"]) assert.equal((androidManifest + androidStrings).includes(external), false);
});

test("Digital Asset Links fails safely until Play certificate is supplied", () => {
  assert.deepEqual(assetlinks, []);
  assert.match(assetlinksTemplate, /"package_name": "com\.todijo\.marketplace"/);
  assert.match(assetlinksTemplate, /REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT/);
  assert.doesNotMatch(assetlinksTemplate, /(?:[A-F0-9]{2}:){31}[A-F0-9]{2}/);
});

test("Stage 1 introduces no native business, auth, payment or database code", () => {
  assert.equal(fs.existsSync("android/app/src/main/java"), false);
  assert.equal(fs.existsSync("android/app/src/main/kotlin"), false);
  assert.doesNotMatch(androidBuild, /stripe|firebase|billing|auth/i);
});
