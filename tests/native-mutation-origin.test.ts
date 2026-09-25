import assert from "node:assert/strict";
import test from "node:test";
import { isNativeApiMutationRequest, isTrustedMutationRequest } from "../lib/request-security";

const request = (headers: Record<string, string> = {}) => new Request("https://todijo.com/api/mobile/auth/login", {
  method: "POST", headers,
});

test("native login without browser origin reaches its server-side authentication handler", () => {
  assert.equal(isNativeApiMutationRequest(request(), "/api/mobile/auth/login"), true);
  assert.equal(isNativeApiMutationRequest(request(), "/api/products"), false);
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
