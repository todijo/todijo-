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
    assert.equal(adminEntryPath(locale), `/${locale}/admin`);
    assert.equal(postLoginDestination("ADMIN", `/${locale}/login`, locale), `/${locale}/admin`);
  }
  const source = read("app", "admin", "page.tsx");
  assert.match(source, /login\?next=\/\$\{locale\}\/admin/);
  assert.match(source, /redirect\(`\/\$\{locale\}\/adm-barewbar-182203`\)/);
  assert.doesNotMatch(source, /redirect\(`\/\$\{locale\}\/login`\);\s*redirect/);
});

test("middleware canonicalizes /admin once and rewrites localized admin without a loop", () => {
  const entry = middleware(new NextRequest("https://todijo.test/admin", { headers: { "accept-language": "fr" } }));
  assert.equal(entry.status, 307);
  assert.equal(entry.headers.get("location"), "https://todijo.test/fr/admin");
  const localized = middleware(new NextRequest("https://todijo.test/fr/admin"));
  assert.equal(localized.status, 200);
  assert.equal(new URL(localized.headers.get("x-middleware-rewrite")!).pathname, "/admin");
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
  const entry = read("app", "admin", "page.tsx");
  const moderation = read("app", "adm-barewbar-182203", "moderation", "page.tsx");
  const moderationApi = read("app", "api", "admin", "moderation", "product-reports", "[reportId]", "route.ts");
  for (const source of [entry, moderation, moderationApi]) assert.match(source, /requireAdmin\(prisma, session\)/);
});
