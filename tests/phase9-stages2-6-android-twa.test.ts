import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { safeLoginDestination } from "../lib/auth-redirects";
import { stripeMinorAmount } from "../lib/currency";

const source = (path: string) => fs.readFileSync(path, "utf8");

test("stage 2 keeps TWA authentication cookie-based and rejects open redirects", () => {
  const session = source("lib/session.ts");
  assert.match(session, /httpOnly: true/);
  assert.match(session, /sameSite: "lax"/);
  assert.match(session, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(session, /authVersion/);
  assert.equal(safeLoginDestination("https://evil.example/steal", "fr"), "/fr");
  assert.equal(safeLoginDestination("//evil.example/steal", "ar"), "/ar");
  assert.equal(safeLoginDestination("/en/account/orders/owned?tab=tracking", "fr"), "/fr/account/orders/owned?tab=tracking");
  const callback = source("app/api/auth/social/[provider]/callback/route.ts");
  assert.match(callback, /INVALID_STATE/);
  assert.match(callback, /stateData\?\.next/);
  assert.match(callback, /`\/\$\{locale\}\/login`/);
});

test("stage 3 keeps favorites and cart isolated per authenticated user", () => {
  const favorites = source("components/WishlistProvider.tsx");
  const cart = source("components/CartProvider.tsx");
  assert.match(favorites, /user:\$\{userId\}/);
  assert.match(favorites, /:guest/);
  assert.match(cart, /\$\{STORAGE_KEY\}:\$\{session\.userId\}/);
  assert.match(cart, /fetch\("\/api\/auth\/session"/);
  assert.match(source("components/ShareButton.tsx"), /navigator\.share/);
  assert.match(source("public/sw.js"), /PUBLIC_IMAGE_PREFIXES/);
});

test("stage 4 localizes Stripe App Link returns and preserves minor-unit authority", () => {
  const stripe = source("lib/stripe.ts");
  const checkout = source("app/api/checkout/route.ts");
  assert.equal(stripeMinorAmount("9.69", "EUR"), 969);
  assert.match(stripe, /returnPrefix/);
  assert.match(stripe, /\$\{returnPrefix\}\/checkout\/success/);
  assert.match(stripe, /\$\{returnPrefix\}\/checkout\/cancel/);
  assert.match(checkout, /localeFromReferer/);
  assert.match(source("app/checkout/success/page.tsx"), /paidAt/);
  assert.match(source("app/checkout/success/page.tsx"), /t\("verifying"\)/);
});

test("stage 5 order and tracking deep links retain server ownership and safe carriers", () => {
  const detail = source("app/[locale]/account/orders/[orderId]/page.tsx");
  const tracking = source("lib/tracking.ts");
  assert.match(detail, /getBuyerOrder\(prisma, session\.userId, orderId\)/);
  assert.match(tracking, /safeCarrierTrackingUrl/);
  assert.match(tracking, /return carrierTrackingAdapter\(carrier\)\?\.trackingUrl/);
  assert.doesNotMatch(source("components/ShipmentTrackingCard.tsx"), /dangerouslySetInnerHTML/);
});

test("stage 6 push UI is conservative, route-allowlisted and never auto-prompts", () => {
  const worker = source("public/sw.js");
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("notificationclick"/);
  assert.match(worker, /PUSH_PATH\.test/);
  assert.match(worker, /clients\.openWindow/);
  assert.doesNotMatch(worker, /value\?\.(?:body|title)/);
  const allClient = source("components/ServiceWorkerRegistration.tsx") + source("components/NotificationActions.tsx");
  assert.doesNotMatch(allClient, /Notification\.requestPermission/);
});

test("PWA sensitive commerce paths remain network-only after the cache version update", () => {
  const worker = source("public/sw.js");
  for (const path of ["api", "checkout", "cart", "account", "orders?", "messages", "notifications", "favorites", "login"]) assert.match(worker, new RegExp(path.replace("?", "\\?")));
  assert.match(worker, /phase9-stages2-6-v1/);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("Android API 36 shell keeps broad HTTPS App Links and predictive back", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");
  const gradle = source("android/app/build.gradle.kts");
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="todijo\.com"/);
  assert.match(manifest, /android:pathPrefix="\/"/);
  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/);
  assert.match(gradle, /compileSdk = 36/);
  assert.match(gradle, /targetSdk = 36/);
});
