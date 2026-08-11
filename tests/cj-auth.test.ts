import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CjAuthService } from "../lib/suppliers/cj-auth";
import { CjCatalogProvider } from "../lib/suppliers/cj-client";

const tokenResponse = (accessToken: string, accessExpiry: string, refreshToken = "refresh-secret", refreshExpiry = "2030-01-01T00:00:00.000Z") =>
  new Response(JSON.stringify({ result: true, success: true, data: { accessToken, accessTokenExpiryDate: accessExpiry, refreshToken, refreshTokenExpiryDate: refreshExpiry } }), { status: 200 });

test("CJ API key acquires and caches an access token without leaking the key", async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const auth = new CjAuthService({ apiKey: "api-key-secret", now: () => Date.parse("2026-01-01T00:00:00Z"), fetcher: async (input, init) => {
    requests.push({ url: String(input), body: String(init?.body) });
    return tokenResponse("access-secret", "2026-01-02T00:00:00Z");
  }});
  assert.equal(await auth.getAccessToken(), "access-secret");
  assert.equal(await auth.getAccessToken(), "access-secret");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /authentication\/getAccessToken$/);
  assert.deepEqual(JSON.parse(requests[0].body), { apiKey: "api-key-secret" });
});

test("CJ authentication fails closed when no credential is configured and preserves static fallback", async () => {
  const missing = new CjAuthService({ apiKey: "", staticAccessToken: "" });
  assert.equal(missing.isConfigured(), false);
  await assert.rejects(() => missing.getAccessToken(), /CJ_NOT_CONFIGURED/);
  const fallback = new CjAuthService({ staticAccessToken: "legacy-token" });
  assert.equal(await fallback.getAccessToken(), "legacy-token");
});

test("expired access token refreshes once and failed refresh reacquires with API key", async () => {
  let now = Date.parse("2026-01-01T00:00:00Z");
  const paths: string[] = [];
  const auth = new CjAuthService({ apiKey: "key", now: () => now, fetcher: async (input) => {
    const path = String(input); paths.push(path);
    if (paths.length === 1) return tokenResponse("first", "2026-01-01T01:00:00Z");
    if (path.endsWith("refreshAccessToken")) return new Response(JSON.stringify({ result: false, success: false }), { status: 401 });
    return tokenResponse("reacquired", "2026-01-03T00:00:00Z");
  }});
  assert.equal(await auth.getAccessToken(), "first");
  now = Date.parse("2026-01-01T01:00:00Z");
  assert.equal(await auth.getAccessToken(), "reacquired");
  assert.deepEqual(paths.map((path) => path.split("/").pop()), ["getAccessToken", "refreshAccessToken", "getAccessToken"]);
});

test("CJ authentication classifies upstream and credential failures without secret text", async () => {
  const unavailable = new CjAuthService({ apiKey: "never-print-me", fetcher: async () => { throw new Error("network includes never-print-me"); } });
  await assert.rejects(() => unavailable.getAccessToken(), (error: Error) => error.message === "CJ_UNAVAILABLE" && !error.message.includes("never-print-me"));
  const rejected = new CjAuthService({ apiKey: "never-print-me", fetcher: async () => new Response(JSON.stringify({ result: false, message: "bad never-print-me" }), { status: 401 }) });
  await assert.rejects(() => rejected.getAccessToken(), (error: Error) => error.message === "CJ_AUTHENTICATION_FAILED" && !error.message.includes("never-print-me"));
});

test("CJ read calls invalidate and retry authentication at most once", async () => {
  let tokens = 0;
  let invalidations = 0;
  const auth = { isConfigured: () => true, getAccessToken: async () => `token-${++tokens}`, invalidateAccessToken: () => { invalidations += 1; } };
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ code: 1600001, result: false }), { status: 401 });
    return new Response(JSON.stringify({ result: true, success: true, data: {} }), { status: 200 });
  };
  try {
    await new CjCatalogProvider(auth).testConnection();
    assert.equal(calls, 2); assert.equal(tokens, 2); assert.equal(invalidations, 1);
    calls = 0; tokens = 0; invalidations = 0;
    global.fetch = async () => { calls += 1; return new Response(JSON.stringify({ code: 1600001, result: false }), { status: 401 }); };
    await assert.rejects(() => new CjCatalogProvider(auth).testConnection(), /CJ_AUTHENTICATION_FAILED/);
    assert.equal(calls, 2); assert.equal(tokens, 2); assert.equal(invalidations, 1);
  } finally { global.fetch = originalFetch; }
});

test("CJ connectivity is read-only and credentials stay server-only", () => {
  const root = resolve(__dirname, "../..");
  const client = readFileSync(resolve(root, "lib/suppliers/cj-client.ts"), "utf8");
  const auth = readFileSync(resolve(root, "lib/suppliers/cj-auth.ts"), "utf8");
  const status = readFileSync(resolve(root, "app/api/supplier/cj/status/route.ts"), "utf8");
  assert.match(client, /\/setting\/get/);
  assert.doesNotMatch(`${client}\n${auth}\n${status}`, /shopping\/order|payBalance|createOrder|NEXT_PUBLIC_CJ/i);
  assert.match(status, /SELLER.*ADMIN/);
  assert.doesNotMatch(status, /CJ_API_KEY|CJ_ACCESS_TOKEN|accessToken|apiKey/);
});
