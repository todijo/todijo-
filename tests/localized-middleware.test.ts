import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production localized rewrites preserve locale through the internal root-route handoff", () => {
  const middleware = readFileSync("middleware.ts", "utf8");

  assert.match(middleware, /const localRewriteLocale = request\.nextUrl\.searchParams\.get\("__todijo_local_locale"\)/);
  assert.match(middleware, /if \(isLocale\(localRewriteLocale\)\)/);
  assert.match(middleware, /url\.searchParams\.set\("__todijo_local_locale", pathLocale\)/);
  assert.match(middleware, /requestHeaders\.set\("x-todijo-locale", pathLocale\)/);
  assert.doesNotMatch(middleware, /NODE_ENV !== "production" && isLocale\(localRewriteLocale\)/);
});

test("localized dashboard continues to use its direct route path", () => {
  const middleware = readFileSync("middleware.ts", "utf8");

  assert.match(middleware, /const isLocalizedDashboard = segments\.length === 2 && segments\[1\] === "dashboard"/);
  assert.match(middleware, /isLocalizedDashboard \|\| isLocalizedConnectCallback/);
});
