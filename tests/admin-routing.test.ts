import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { AdminAccessError, requireAdmin } from "../lib/admin-access";
import { adminEntryPath, postLoginDestination } from "../lib/auth-redirects";
import { middleware } from "../middleware";

type Db = Parameters<typeof requireAdmin>[0];
const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("admin entry is locale-safe and login cannot loop back to login", () => {
  for (const locale of ["en", "fr", "ar", "ku"] as const) {
    assert.equal(adminEntryPath(locale), `/${locale}/adm-barewbar-182203`);
    assert.equal(postLoginDestination("ADMIN", `/${locale}/login`, locale), `/${locale}/adm-barewbar-182203`);
  }
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "admin", "page.tsx")), false);
});

test("obvious admin entry aliases reach the same not-found route without redirecting", () => {
  for (const route of ["/admin", "/fr/admin", "/admin/login", "/fr/admin/login"]) {
    const response = middleware(new NextRequest(`https://todijo.test${route}`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
    assert.equal(new URL(response.headers.get("x-middleware-rewrite")!).pathname, route.endsWith("/login") ? "/admin/login" : "/admin");
  }
  const alias = read("app", "admin", "[[...slug]]", "page.tsx");
  assert.match(alias, /notFound\(\)/);
  const privateEntry = middleware(new NextRequest("https://todijo.test/fr/adm-barewbar-182203"));
  assert.equal(privateEntry.status, 200);
  assert.equal(new URL(privateEntry.headers.get("x-middleware-rewrite")!).pathname, "/adm-barewbar-182203");
});

test("admin entry and moderation keep the database role as authority", async () => {
  const unused = {} as Db;
  await assert.rejects(() => requireAdmin(unused, null), (error: unknown) => error instanceof AdminAccessError && error.status === 401);
  for (const role of ["CUSTOMER", "SELLER"] as const) {
    const db = { user: { findUnique: async () => ({ id: role.toLowerCase(), role }) } } as unknown as Db;
    await assert.rejects(() => requireAdmin(db, { userId: role.toLowerCase(), role }), (error: unknown) => error instanceof AdminAccessError && error.status === 403);
  }
  const adminDb = { user: { findUnique: async () => ({ id: "admin", role: "ADMIN" }) } } as unknown as Db;
  assert.deepEqual(await requireAdmin(adminDb, { userId: "admin", role: "ADMIN" }), { id: "admin", role: "ADMIN" });
  const entry = read("app", "adm-barewbar-182203", "page.tsx");
  const moderation = read("app", "adm-barewbar-182203", "moderation", "page.tsx");
  const moderationApi = read("app", "api", "admin", "moderation", "product-reports", "[reportId]", "route.ts");
  for (const source of [entry, moderation, moderationApi]) assert.match(source, /requireAdmin\(prisma, session\)/);
});
