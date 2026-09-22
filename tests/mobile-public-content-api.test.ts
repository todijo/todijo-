import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
test("mobile public content exposes only active published CMS revisions", () => {
  const route = read("app/api/marketplace/content/[key]/route.ts"), service = read("lib/site-content.ts");
  assert.match(route, /getPublishedSiteContent/);
  assert.match(route, /siteContentDefinition/);
  assert.match(service, /status:\s*"ACTIVE"/);
  assert.doesNotMatch(route, /siteContentRevision\.findMany|DRAFT/);
});
test("mobile public news is published and time bounded", () => {
  for (const path of ["app/api/marketplace/news/route.ts", "app/api/marketplace/news/[id]/route.ts"]) {
    const source = read(path);
    assert.match(source, /published:\s*true/);
    assert.match(source, /publishedAt:\s*\{\s*lte:/);
    assert.match(source, /resolveNewsContent/);
  }
});
