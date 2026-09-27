import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { isNativeApiMutationRequest, isTrustedMutationRequest } from "../lib/request-security";
import { middleware } from "../middleware";

const request = (headers: Record<string, string> = {}) => new Request("https://todijo.com/api/mobile/auth/login", {
  method: "POST", headers,
});

test("native login without browser origin reaches its server-side authentication handler", () => {
  assert.equal(isNativeApiMutationRequest(request(), "/api/mobile/auth/login"), true);
  assert.equal(isNativeApiMutationRequest(request(), "/api/products"), false);
  const response = middleware(new NextRequest("https://todijo.com/api/mobile/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("native password recovery reuses the neutral web handler without opening browser mutations", () => {
  const path = "/api/mobile/auth/forgot-password";
  assert.match(
    readFileSync("app/api/mobile/auth/forgot-password/route.ts", "utf8"),
    /export \{ POST \} from "@\/app\/api\/auth\/forgot-password\/route"/,
  );
  const native = middleware(new NextRequest(`https://todijo.com${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  }));
  assert.equal(native.status, 200);
  const forged = middleware(new NextRequest(`https://todijo.com${path}`, {
    method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, body: "{}",
  }));
  assert.equal(forged.status, 403);
  const browserOnly = middleware(new NextRequest("https://todijo.com/api/auth/forgot-password", {
    method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, body: "{}",
  }));
  assert.equal(browserOnly.status, 403);
});

test("native verification resend uses the neutral web handler and still rejects forged origins", () => {
  const path = "/api/mobile/auth/resend-verification";
  assert.match(
    readFileSync("app/api/mobile/auth/resend-verification/route.ts", "utf8"),
    /export \{ POST \} from "@\/app\/api\/auth\/resend-verification\/route"/,
  );
  const native = middleware(new NextRequest(`https://todijo.com${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  }));
  assert.equal(native.status, 200);
  const forged = middleware(new NextRequest(`https://todijo.com${path}`, {
    method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, body: "{}",
  }));
  assert.equal(forged.status, 403);
});

test("production origin policy admits only origin-less native login", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.APP_URL;
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.APP_URL = "https://todijo.com";
    assert.equal(isTrustedMutationRequest(request()), false);
    const nativeResponse = middleware(new NextRequest("https://todijo.com/api/mobile/auth/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }));
    assert.equal(nativeResponse.status, 200);
    const forgedResponse = middleware(new NextRequest("https://todijo.com/api/mobile/auth/login", {
      method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, body: "{}",
    }));
    assert.equal(forgedResponse.status, 403);
  } finally {
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
  }
});

test("native login exemption does not admit forged browser origins", () => {
  const attempts: Record<string, string>[] = [
    { origin: "https://attacker.example" },
    { origin: "https://attacker.example", "sec-fetch-site": "same-origin" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of attempts) {
    const response = middleware(new NextRequest("https://todijo.com/api/mobile/auth/login", {
      method: "POST", headers, body: "{}",
    }));
    assert.equal(response.status, 403);
  }
  const sameOrigin = middleware(new NextRequest("https://todijo.com/api/mobile/auth/login", {
    method: "POST", headers: { origin: "https://todijo.com", "sec-fetch-site": "same-origin" }, body: "{}",
  }));
  assert.equal(sameOrigin.status, 200);
});

test("origin exemption leaves password authentication and invalid-credential rejection intact", () => {
  const route = readFileSync("app/api/mobile/auth/login/route.ts", "utf8");
  assert.match(route, /compare\(password, user\.passwordHash\)/);
  assert.match(route, /error: "INVALID_CREDENTIALS".*status: 401/);
  assert.match(route, /createMobileSession\(user/);
});

test("native bearer mutations reach protected handlers but cross-origin browser requests do not", () => {
  const bearer = { authorization: "Bearer token.example" };
  assert.equal(isNativeApiMutationRequest(request(bearer), "/api/mobile/cart"), true);
  assert.equal(isNativeApiMutationRequest(request(bearer), "/api/products"), true);
  assert.equal(isNativeApiMutationRequest(request({ ...bearer, origin: "https://attacker.example" }), "/api/products"), false);
  assert.equal(isTrustedMutationRequest(request({ ...bearer, origin: "https://attacker.example" })), false);
  assert.equal(isNativeApiMutationRequest(request({ ...bearer, "sec-fetch-site": "cross-site" }), "/api/products"), false);
  assert.equal(isNativeApiMutationRequest(request({ authorization: "Basic abc" }), "/api/products"), false);
});

test("forged forwarding headers cannot redefine the browser same-origin boundary", () => {
  const attempt = request({
    origin: "https://attacker.example",
    "sec-fetch-site": "same-origin",
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "https",
  });
  assert.equal(isTrustedMutationRequest(attempt), false);
});

test("disposable Android WebView origin reaches local web login only", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    Reflect.set(process.env, "NODE_ENV", "development");
    const attempt = (url: string, origin: string, site = "same-origin") => middleware(new NextRequest(url, {
      method: "POST", headers: { origin, "sec-fetch-site": site }, body: "{}",
    }));
    assert.equal(attempt("http://localhost:3001/api/auth/login", "http://10.0.2.2:3001").status, 200);
    assert.equal(attempt("http://localhost:3001/api/auth/login", "http://10.0.2.2:3002").status, 403);
    assert.equal(attempt("http://localhost:3001/api/auth/login", "http://evil.example").status, 403);
    assert.equal(attempt("http://localhost:3001/api/auth/login", "http://10.0.2.2:3001", "cross-site").status, 403);
    assert.equal(attempt("https://todijo.com/api/auth/login", "http://10.0.2.2:3001").status, 403);
    assert.equal(attempt("http://192.168.1.20:3001/api/auth/login", "http://10.0.2.2:3001").status, 403);
    Reflect.set(process.env, "NODE_ENV", "production");
    assert.equal(attempt("http://localhost:3001/api/auth/login", "http://10.0.2.2:3001").status, 403);
  } finally {
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
  }
});
