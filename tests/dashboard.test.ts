import test from "node:test";
import assert from "node:assert/strict";
import { dashboardAudience, dashboardPaths } from "../lib/dashboard";

test("dashboard links preserve the active locale", () => {
  assert.deepEqual(dashboardPaths("fr"), { home: "/fr", dashboard: "/fr/dashboard", orders: "/fr/account/orders", messages: "/fr/messages", cart: "/fr/cart" });
});

test("dashboard audience keeps customers in buyer UI and privileged store roles in seller UI", () => {
  assert.equal(dashboardAudience("CUSTOMER"), "buyer");
  assert.equal(dashboardAudience("SELLER"), "seller");
  assert.equal(dashboardAudience("ADMIN"), "seller");
});
