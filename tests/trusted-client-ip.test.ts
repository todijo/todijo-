import assert from "node:assert/strict";
import test from "node:test";
import { authRequestKey } from "../lib/auth-rate-limit";
import { trustedClientIp } from "../lib/trusted-client-ip";

const secret = "trusted-ingress-secret-for-tests-only-32-chars";
const request = (headers: Record<string, string>) => new Request("https://todijo.com/api/auth/login", { headers });

test("direct requests ignore forged forwarding and proxy-secret headers", () => {
  const direct = request({});
  const forged = request({ "x-forwarded-for": "192.0.2.10", "x-real-ip": "192.0.2.11", "cf-connecting-ip": "192.0.2.12" });
  assert.equal(trustedClientIp(forged, secret), null);
  assert.equal(authRequestKey("login", "buyer@example.test", direct, secret), authRequestKey("login", "buyer@example.test", forged, secret));
  assert.equal(trustedClientIp(request({ "x-todijo-proxy-secret": "wrong", "x-forwarded-for": "192.0.2.10" }), secret), null);
});

test("trusted ingress uses the rightmost valid peer, never a client-forged left hop", () => {
  const headers = { "x-todijo-proxy-secret": secret, "x-forwarded-for": "198.51.100.99, 203.0.113.42" };
  assert.equal(trustedClientIp(request(headers), secret), "203.0.113.42");
  assert.equal(trustedClientIp(request({ ...headers, "x-forwarded-for": "1.1.1.1, 198.51.100.99, 203.0.113.42" }), secret), "203.0.113.42");
  assert.equal(trustedClientIp(request({ ...headers, "x-forwarded-for": "2001:DB8::1" }), secret), "2001:db8::1");
  const key = authRequestKey("login", "buyer@example.test", request(headers), secret);
  assert.equal(key, authRequestKey("login", "buyer@example.test", request({ ...headers, "x-forwarded-for": "forged, 203.0.113.42" }), secret));
  assert.notEqual(key, authRequestKey("login", "buyer@example.test", request({ ...headers, "x-forwarded-for": "203.0.113.43" }), secret));
});

test("missing or malformed peer fails closed and cannot create a fresh rate-limit bucket", () => {
  const base = request({ "x-todijo-proxy-secret": secret });
  assert.equal(trustedClientIp(base, secret), null);
  for (const value of ["", "forged", "203.0.113.42:8080", "198.51.100.1, forged"]) {
    const attempt = request({ "x-todijo-proxy-secret": secret, "x-forwarded-for": value });
    assert.equal(trustedClientIp(attempt, secret), null);
    assert.equal(authRequestKey("login", "buyer@example.test", base, secret), authRequestKey("login", "buyer@example.test", attempt, secret));
  }
});
