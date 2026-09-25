import assert from "node:assert/strict";
import test from "node:test";
import { safeServerErrorRecord } from "../lib/safe-server-error";

test("production error record excludes messages, stacks, headers and personal data", () => {
  const error = new Error("password=secret sk_live_sensitive token=private");
  error.stack = "Authorization: Bearer confidential";
  const request = new Request("https://todijo.com/api/checkout", { headers: {
    authorization: "Bearer confidential", "x-request-id": "checkout-123",
  } });
  assert.deepEqual(safeServerErrorRecord("checkout_failed", error, request), {
    event: "checkout_failed", errorClass: "Error", requestId: "checkout-123",
  });
  assert.equal(JSON.stringify(safeServerErrorRecord("checkout_failed", error, request))
    .includes("confidential"), false);
});

test("untrusted request correlation values cannot inject log content", () => {
  const request = new Request("https://todijo.com", { headers: {
    "x-request-id": "buyer@example.com-secret-123",
  } });
  assert.deepEqual(safeServerErrorRecord("auth_failed", { message: "sensitive" }, request), {
    event: "auth_failed", errorClass: "UnknownError",
  });
});
