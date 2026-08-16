import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { decideSocialIdentity, socialProviderStatus, socialProviders } from "../lib/social-auth";

const source = (file: string) => fs.readFileSync(file, "utf8");

test("all OAuth providers remain code-ready and fail closed without credentials", () => {
  assert.deepEqual(socialProviders, ["google", "apple", "facebook"]);
  for (const provider of socialProviders) assert.equal(socialProviderStatus(provider, {}).configured, false);
  assert.equal(socialProviderStatus("facebook", { FACEBOOK_APP_ID: "id" }).configured, false);
  assert.equal(socialProviderStatus("facebook", { FACEBOOK_APP_ID: "id", FACEBOOK_APP_SECRET: "secret" }).configured, true);
  const ui = source("components/SocialLoginButtons.tsx");
  assert.match(ui, /disabled title=\{t\("providerNotConfigured"\)\}/);
});

test("social identity cannot infer roles or unsafe duplicate linking", () => {
  assert.deepEqual(decideSocialIdentity({ email: "admin@example.com", emailVerified: false, emailUserId: "admin" }), { action: "reject", code: "VERIFIED_EMAIL_REQUIRED" });
  assert.deepEqual(decideSocialIdentity({ email: "seller@example.com", emailVerified: true, providerIdentityInUse: true }), { action: "reject", code: "ACCOUNT_ALREADY_LINKED" });
  const callback = source("app/api/auth/social/[provider]/callback/route.ts");
  assert.doesNotMatch(callback, /role:\s*["']ADMIN["']|sellerVerified:\s*true|dropshippingEnabled:\s*true/);
});

test("public privacy and deletion surfaces disclose minimum social data accurately", () => {
  const privacy = source("i18n/oauth-readiness.ts");
  const route = source("app/info/[slug]/page.tsx");
  const footer = source("components/MarketplaceFooter.tsx");
  const sitemap = source("app/sitemaps/[id]/route.ts");
  assert.match(route, /data-deletion/);
  assert.match(footer, /info\("data-deletion"\)/);
  assert.match(sitemap, /data-deletion/);
  for (const provider of ["Google", "Apple", "Facebook"]) assert.match(privacy, new RegExp(provider));
  assert.match(privacy, /provider account identifier/);
  assert.match(privacy, /does not guarantee immediate hard deletion/);
  assert.match(privacy, /completed orders/);
  assert.match(privacy, /does not request Gmail, Google Drive, contacts, Facebook posts, friends, messages, photos or advertising data/);
});

test("provider runbook documents exact public configuration without secret values", () => {
  const docs = source("docs/oauth-provider-readiness.md");
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"]) assert.match(docs, new RegExp(name));
  for (const path of ["/api/auth/social/google/callback", "/api/auth/social/apple/callback", "/api/auth/social/facebook/callback", "/en/info/data-deletion"]) assert.match(docs, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(docs, /PROVIDER CONFIGURATION PENDING/);
  assert.doesNotMatch(docs, /(client_secret|app_secret)\s*=\s*\S+/i);
});

test("registration exposes localized Terms and Privacy links without changing consent authority", () => {
  const registration = source("app/register/RegisterForm.tsx");
  assert.match(registration, /info\/terms/);
  assert.match(registration, /info\/privacy/);
  assert.match(registration, /type="checkbox" required/);
});
