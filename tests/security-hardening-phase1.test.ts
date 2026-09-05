import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { allowAuthRequest, type AuthRateLimitStore } from "../lib/auth-rate-limit";
import { isTrustedMutationRequest } from "../lib/request-security";

const source = (path: string) => readFileSync(path, "utf8");

test("production authentication limiting fails closed when the shared store is unavailable", async () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  const unavailable: AuthRateLimitStore = { consume: async () => { throw new Error("database unavailable"); } };
  try {
    assert.equal(await allowAuthRequest("a".repeat(64), Date.now(), unavailable), false);
  } finally {
    Object.assign(process.env, { NODE_ENV: previous });
  }
});

test("shared authentication buckets are atomic, expiring, and self-cleaning", () => {
  const limiter = source("lib/auth-rate-limit.ts");
  const migration = source("prisma/migrations/20260905010000_add_shared_auth_rate_limits/migration.sql");
  assert.match(limiter, /ON CONFLICT \("key"\) DO UPDATE/);
  assert.match(limiter, /DELETE FROM "AuthRateLimitBucket"/);
  assert.match(limiter, /"expiresAt" <=/);
  assert.doesNotMatch(limiter, /process\.env\.NODE_ENV === "production" \? developmentStore/);
  assert.match(migration, /CREATE INDEX "AuthRateLimitBucket_expiresAt_idx"/);
  assert.doesNotMatch(migration, /DROP|TRUNCATE/i);
});

test("authentication attack surfaces await the shared limiter", () => {
  for (const path of [
    "app/api/auth/login/route.ts",
    "app/api/auth/register/route.ts",
    "app/api/auth/forgot-password/route.ts",
    "app/api/auth/reset-password/route.ts",
    "app/api/auth/resend-verification/route.ts",
    "app/api/auth/social/[provider]/start/route.ts",
    "app/api/auth/social/[provider]/callback/route.ts",
  ]) assert.match(source(path), /await allowAuthRequest/);
});

test("cookie-authenticated mutations reject cross-site origins while webhooks and OAuth callbacks remain exempt", () => {
  assert.equal(isTrustedMutationRequest(new Request("https://todijo.com/api/account/profile", { method: "POST", headers: { origin: "https://todijo.com", "sec-fetch-site": "same-origin" } })), true);
  assert.equal(isTrustedMutationRequest(new Request("https://todijo.com/api/account/profile", { method: "POST", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })), false);
  const middleware = source("middleware.ts");
  assert.match(middleware, /pathname === "\/api\/stripe\/webhook"/);
  assert.match(middleware, /\/api\/internal\//);
  assert.match(middleware, /auth\\\/social/);
  assert.match(middleware, /INVALID_MUTATION_ORIGIN/);
});

test("production headers define a bounded CSP and HSTS without unsafe eval", () => {
  const config = source("next.config.ts");
  for (const directive of ["default-src", "script-src", "style-src", "img-src", "font-src", "connect-src", "frame-src", "form-action", "base-uri", "object-src", "frame-ancestors"]) {
    assert.match(config, new RegExp(directive));
  }
  assert.match(config, /NODE_ENV === "production" \? "" : " 'unsafe-eval'"/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /NODE_ENV === "production"/);
});

test("production image runs as an unprivileged dedicated user", () => {
  const dockerfile = source("Dockerfile");
  assert.match(dockerfile, /useradd --system --uid 1001 --gid nodejs nextjs/);
  assert.match(dockerfile, /COPY --chown=nextjs:nodejs --from=builder/);
  assert.match(dockerfile, /USER nextjs/);
});
