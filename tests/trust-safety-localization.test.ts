import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales, rtlLocales } from "../i18n/config";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
function leaves(value: unknown, prefix = "", result = new Map<string, string>()) {
  if (value && typeof value === "object" && !Array.isArray(value)) for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, result);
  else result.set(prefix, String(value));
  return result;
}
const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z][\w]*)/g)].map(match => match[1]).sort();

test("Trust & Safety has exact key and placeholder parity in all 14 locales", () => {
  assert.equal(locales.length, 14);
  const english = leaves(JSON.parse(read("messages", "trust-safety", "en.json")));
  for (const locale of locales) {
    const source = read("messages", "trust-safety", `${locale}.json`);
    assert.doesNotMatch(source, /\uFFFD|Ãƒ|Â·|â€¦/, locale);
    const localized = leaves(JSON.parse(source));
    assert.deepEqual([...localized.keys()].sort(), [...english.keys()].sort(), locale);
    for (const [key, value] of english) assert.deepEqual(placeholders(localized.get(key)!), placeholders(value), `${locale}:${key}`);
  }
});

test("localized moderation covers real statuses, actions, neutral counterfeit/IP labels and seller notices", () => {
  for (const locale of locales) {
    const messages = leaves(JSON.parse(read("messages", "trust-safety", `${locale}.json`)));
    for (const key of ["status.OPEN","status.UNDER_REVIEW","status.RESOLVED","status.DISMISSED","action.NONE","action.UNPUBLISH","reason.COUNTERFEIT","reason.INTELLECTUAL_PROPERTY","notificationTitle","notificationBody"]) assert.ok(messages.get(key)?.trim(), `${locale}:${key}`);
    assert.deepEqual(placeholders(messages.get("notificationBody")!), ["product"]);
  }
  assert.deepEqual([...rtlLocales].sort(), ["ar", "fa", "ku"]);
  const route = read("app", "api", "admin", "moderation", "product-reports", "[reportId]", "route.ts");
  assert.match(route, /getTranslations\(\{ locale: sellerLocale, namespace: "TrustSafety" \}\)/);
  assert.doesNotMatch(route, /reporter\.email|reporterId/);
});
