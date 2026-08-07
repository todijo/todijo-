import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales, rtlLocales } from "../i18n/config";
import { buildLocalizedPath } from "../lib/locale-routing";

const root = process.cwd();
const messagesRoot = path.join(root, "messages");

function leaves(value: unknown, prefix = "", result = new Map<string, string>()) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, result);
  } else result.set(prefix, String(value));
  return result;
}

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z][\w]*)/g)].map((match) => match[1]).sort();
}

test("Simplified Chinese is a supported LTR locale and preserves localized routes", () => {
  assert.ok(locales.includes("zh"));
  assert.equal(rtlLocales.has("zh"), false);
  assert.equal(buildLocalizedPath("/fr/login", "zh"), "/zh/login");
  assert.equal(buildLocalizedPath("/zh/register", "en"), "/en/register");
  assert.equal(buildLocalizedPath("/en/dashboard", "zh"), "/zh/dashboard");
  assert.equal(buildLocalizedPath("/tr/seller/products", "zh"), "/zh/seller/products");
  assert.equal(buildLocalizedPath("/ku/product/abc", "zh", "ref=saved"), "/zh/product/abc?ref=saved");
});

test("every English translation namespace has a case-correct Chinese file with key and placeholder parity", () => {
  const directories = [messagesRoot, ...fs.readdirSync(messagesRoot).map((name) => path.join(messagesRoot, name)).filter((entry) => fs.statSync(entry).isDirectory())];
  for (const directory of directories) {
    const englishPath = path.join(directory, "en.json");
    if (!fs.existsSync(englishPath)) continue;
    const chinesePath = path.join(directory, "zh.json");
    assert.ok(fs.existsSync(chinesePath), `Missing ${path.relative(root, chinesePath)}`);
    const chineseSource = fs.readFileSync(chinesePath, "utf8");
    assert.doesNotMatch(chineseSource, /\uFFFD|Ã|Â|â€|ðŸ|Ø|Ù|Ú/, `Invalid UTF-8 text in ${path.relative(root, chinesePath)}`);
    const english = leaves(JSON.parse(fs.readFileSync(englishPath, "utf8")));
    const chinese = leaves(JSON.parse(chineseSource));
    assert.deepEqual([...chinese.keys()].sort(), [...english.keys()].sort(), `Key mismatch in ${path.relative(root, chinesePath)}`);
    for (const [key, value] of english) assert.deepEqual(placeholders(chinese.get(key)!), placeholders(value), `Placeholder mismatch in ${path.relative(root, chinesePath)}:${key}`);
  }
});

test("Chinese namespaces, selector label, and document direction use the existing locale architecture", () => {
  const request = fs.readFileSync(path.join(root, "i18n/request.ts"), "utf8");
  const switcher = fs.readFileSync(path.join(root, "components/LanguageSwitcher.tsx"), "utf8");
  const footer = fs.readFileSync(path.join(root, "components/MarketplaceFooter.tsx"), "utf8");
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(request, /\["fa", "fr", "hi", "pt", "ru", "zh"\]\.includes\(locale\)/);
  assert.match(request, /"ar", "en", "fa", "fr", "hi", "ku", "pt", "ru", "zh"/);
  assert.match(switcher, /zh: "简体中文"/);
  assert.match(footer, /`\/\$\{locale\}\/register\?role=seller`/);
  assert.match(footer, /`\/\$\{locale\}\/dashboard`/);
  assert.match(footer, /`\/\$\{locale\}\/seller\/create-store`/);
  assert.match(layout, /<html lang=\{locale\} dir=\{rtlLocales\.has\(locale\) \? "rtl" : "ltr"\}>/);
});
