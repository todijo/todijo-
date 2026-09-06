import assert from "node:assert/strict";
import test from "node:test";
import { hasValidBearerSecret } from "../lib/internal-request-auth";

const request = (authorization?: string) => new Request("https://todijo.com/api/internal/worker", {
  method: "POST",
  headers: authorization ? { authorization } : undefined,
});

test("internal bearer authentication fails closed and accepts only the configured secret", () => {
  assert.equal(hasValidBearerSecret(request(), "secret"), false);
  assert.equal(hasValidBearerSecret(request("Bearer secret"), undefined), false);
  assert.equal(hasValidBearerSecret(request("Bearer wrong"), "secret"), false);
  assert.equal(hasValidBearerSecret(request("Bearer secret"), " secret "), true);
});

test("strict workers preserve strict Bearer parsing while the refund worker preserves its flexible scheme", () => {
  assert.equal(hasValidBearerSecret(request("bearer secret"), "secret"), false);
  assert.equal(hasValidBearerSecret(request("Bearer   secret"), "secret"), false);
  assert.equal(hasValidBearerSecret(request("bearer   secret"), "secret", { flexibleSchemeWhitespace: true }), true);
});
