import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cartLineKey } from "../lib/cart-line";

const read = (path: string) => readFileSync(path, "utf8");

test("mobile favorites are bearer-owned and limited to public products", () => {
  const source = read("app/api/mobile/favorites/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /userId:session\.userId/);
  assert.match(source, /status:"PUBLISHED"/);
  assert.match(source, /publicProductAccessWhere\(\)/);
  assert.doesNotMatch(source, /body\?\.userId|body\.userId/);
});

test("mobile cart persists identity and selections but never client prices", () => {
  const source = read("app/api/mobile/cart/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /userId:\s*session\.userId/);
  assert.match(source, /cartLineKey\(line\.productId, line\.selectedColor, line\.selectedSize, line\.variantId\)/);
  assert.match(source, /variant\.id === line\.variantId && variant\.active/);
  assert.notEqual(cartLineKey("p", "Red", "M"), cartLineKey("p", "Blue", "M"));
  assert.notEqual(cartLineKey("p", null, null, "v1"), cartLineKey("p", null, null, "v2"));
  assert.doesNotMatch(source, /body\?\.(?:price|currency)|item\.(?:price|currency)/);
});

test("mobile buyer-state migration is additive", () => {
  const source = read(
    "prisma/migrations/20260922123000_add_mobile_buyer_state/migration.sql",
  );
  assert.match(source, /CREATE TABLE "MobileFavorite"/);
  assert.match(source, /CREATE TABLE "MobileCartLine"/);
  assert.match(source, /CREATE TABLE "MobilePushDevice"/);
  assert.doesNotMatch(source, /\b(?:DROP|TRUNCATE)\b|^\s*DELETE\s+FROM\b/im);
});

test("native push registration is bearer-owned and raw tokens are encrypted", () => {
  const route = read("app/api/mobile/push/devices/route.ts");
  const service = read("lib/mobile-push.ts");
  const registration = read("lib/mobile-push-registration.ts");
  const webview = read("app/api/mobile/push/webview-devices/route.ts");
  assert.match(route, /readMobileSession\(request\)/);
  assert.match(route, /registerMobilePushDevice\(session\.userId,body\)/);
  assert.match(registration, /userId,tokenHash,tokenEncrypted:encryptMobilePushToken\(token\)/);
  assert.match(registration, /tokenHash=mobilePushHash\(token\)/);
  assert.doesNotMatch(registration, /data:\{[^}]*token,/);
  assert.match(webview, /readSession\(\)/);
  assert.match(webview, /registerMobilePushDevice\(session\.userId/);
  assert.match(service, /createCipheriv\("aes-256-gcm"/);
  assert.match(service, /createHash\("sha256"\)/);
});

test("mobile checkout returns through a deep link without trusting it as payment authority", () => {
  const route = read("app/api/mobile/checkout/route.ts");
  const stripe = read("lib/stripe.ts");
  const page = read("app/mobile/checkout/return/page.tsx");
  assert.match(route, /returnTarget:"mobile"/);
  assert.match(stripe, /mobile\/checkout\/return\?status=success/);
  assert.match(page, /todijo:\/\/checkout\/return/);
  assert.match(page, /Todijo vérifie maintenant la commande/);
  assert.doesNotMatch(page, /Paiement reçu|Paiement confirmé/);
  assert.doesNotMatch(page, /status.*PAID|paymentState.*PAID/);
});

test("local marketplace presentment reuses checkout FX and refuses supplier prices", () => {
  const source = read("app/api/marketplace/products/[id]/presentment/route.ts");
  assert.match(source, /publicProductAccessWhere\(\)/);
  assert.match(source, /status: "PUBLISHED"/);
  assert.match(source, /requiresAuthoritativeDropshippingPrice/);
  assert.match(source, /SUPPLIER_QUOTE_REQUIRED/);
  assert.match(source, /convertMarketplacePrice\(/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(source, /supplierCost|sourceMetadata:\s*product/);
});
