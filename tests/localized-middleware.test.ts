import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

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

test("localized subscription invoice archive reaches its locale route without root rewrite", () => {
  for (const locale of ["en", "fr", "ar"]) {
    const response = middleware(new NextRequest(`https://todijo.test/${locale}/account/invoices`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
  }
});
