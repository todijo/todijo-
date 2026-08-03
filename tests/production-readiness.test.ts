import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("production readiness endpoint is dynamic and database-independent", () => {
  const source = fs.readFileSync(path.join(root, "app/api/health/route.ts"), "utf8");

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /export function GET\(\)/);
  assert.match(source, /status: "ok"/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(source, /prisma|DATABASE_URL|fetch\(/);
});

test("Nixpacks runs migrations before starting the Next server", () => {
  const source = fs.readFileSync(path.join(root, "nixpacks.toml"), "utf8");

  assert.match(source, /cmd = "npx prisma migrate deploy && npm run start"/);
});
