import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { isNativeMobileLoginRequest } from "../lib/request-security";
import { middleware } from "../middleware";

function productionMiddleware(headers: Record<string, string> = {}, path = "/api/mobile/auth/login") {
  const previous = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", "production");
  try {
    return middleware(new NextRequest(`https://todijo.com${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: "{}",
    }));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previous);
  }
}

test("production native email login reaches the credential handler", () => {
  const request = new Request("https://todijo.com/api/mobile/auth/login", { method: "POST" });
  assert.equal(isNativeMobileLoginRequest(request, "/api/mobile/auth/login"), true);
  const response = productionMiddleware();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("the exemption is only for email login, not arbitrary native mutations", () => {
  assert.equal(productionMiddleware({}, "/api/mobile/auth/register").status, 403);
  assert.equal(productionMiddleware({}, "/api/products").status, 403);
});

test("browser and forged origins remain subject to same-origin protection", () => {
  for (const headers of [
    { origin: "https://attacker.example" },
    { origin: "https://attacker.example", "sec-fetch-site": "same-origin" },
    { "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[]) {
    assert.equal(productionMiddleware(headers).status, 403);
  }
  assert.equal(productionMiddleware({ origin: "https://todijo.com", "sec-fetch-site": "same-origin" }).status, 200);
});

test("login still rejects invalid credentials before creating a session", () => {
  const route = readFileSync("app/api/mobile/auth/login/route.ts", "utf8");
  assert.match(route, /compare\(password, user\.passwordHash\)/);
  assert.match(route, /error: "INVALID_CREDENTIALS".*status: 401/);
  assert.match(route, /createMobileSession\(user/);
});
