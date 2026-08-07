import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { locales, rtlLocales } from "../i18n/config";
import { buildLocalizedPath } from "../lib/locale-routing";

const root = process.cwd();
const addedLocales = ["fa", "hi", "pt", "ru"] as const;

function leaves(value: unknown, prefix = "", result = new Map<string, string>()) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, result);
  } else result.set(prefix, String(value));
  return result;
}

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z][\w]*)/g)].map((match) => match[1]).sort();
}

test("Persian, Hindi, Portuguese, and Russian use the existing locale routing and direction model", () => {
  for (const locale of addedLocales) {
    assert.ok(locales.includes(locale));
    assert.equal(buildLocalizedPath("/fr/product/123", locale, "ref=language"), `/${locale}/product/123?ref=language`);
  }
  assert.deepEqual([...rtlLocales].sort(), ["ar", "fa", "ku"]);
  assert.equal(rtlLocales.has("hi"), false);
  assert.equal(rtlLocales.has("pt"), false);
  assert.equal(rtlLocales.has("ru"), false);
});

test("every new locale has UTF-8-safe key and placeholder parity in every translated namespace", () => {
  const messagesRoot = path.join(root, "messages");
  const directories = [messagesRoot, ...fs.readdirSync(messagesRoot)
    .map((name) => path.join(messagesRoot, name))
    .filter((entry) => fs.statSync(entry).isDirectory())];

  for (const directory of directories) {
    const englishPath = path.join(directory, "en.json");
    if (!fs.existsSync(englishPath)) continue;
    const english = leaves(JSON.parse(fs.readFileSync(englishPath, "utf8")));

    for (const locale of addedLocales) {
      const localizedPath = path.join(directory, `${locale}.json`);
      assert.ok(fs.existsSync(localizedPath), `Missing ${path.relative(root, localizedPath)}`);
      const source = fs.readFileSync(localizedPath, "utf8");
      assert.doesNotMatch(source, /\uFFFD|Ãƒ|Ã‚|Ã¢â‚¬|Ã°Å¸|Ã˜|Ã™|Ãš/, `Invalid UTF-8 in ${path.relative(root, localizedPath)}`);
      const localized = leaves(JSON.parse(source));
      assert.deepEqual([...localized.keys()].sort(), [...english.keys()].sort(), `Key mismatch in ${path.relative(root, localizedPath)}`);
      for (const [key, value] of english) {
        assert.deepEqual(placeholders(localized.get(key)!), placeholders(value), `Placeholder mismatch in ${path.relative(root, localizedPath)}:${key}`);
      }
    }
  }
});

test("new locales are exposed by selectors, namespace loading, detection, and localized store settings", () => {
  const switcher = fs.readFileSync(path.join(root, "components/LanguageSwitcher.tsx"), "utf8");
  const request = fs.readFileSync(path.join(root, "i18n/request.ts"), "utf8");
  const middleware = fs.readFileSync(path.join(root, "middleware.ts"), "utf8");
  const home = fs.readFileSync(path.join(root, "app/HomeClient.tsx"), "utf8");
  const selectors = [
    fs.readFileSync(path.join(root, "app/seller/create-store/CreateStoreForm.tsx"), "utf8"),
    fs.readFileSync(path.join(root, "app/seller/store-settings/StoreSettingsForm.tsx"), "utf8"),
    fs.readFileSync(path.join(root, "app/adm-barewbar-182203/AdminDashboard.tsx"), "utf8"),
  ];

  assert.match(switcher, /fa: "فارسی"/);
  assert.match(switcher, /hi: "हिन्दी"/);
  assert.match(switcher, /pt: "Português"/);
  assert.match(switcher, /ru: "Русский"/);
  assert.match(request, /\["fa", "fr", "hi", "pt", "ru", "zh"\]\.includes\(locale\)/);
  assert.match(request, /"ar", "en", "fa", "fr", "hi", "ku", "pt", "ru", "zh"/);
  assert.match(middleware, /IR: "fa"/);
  assert.match(middleware, /IN: "hi"/);
  assert.match(middleware, /PT: "pt"/);
  assert.match(middleware, /BR: "pt"/);
  assert.match(middleware, /RU: "ru"/);
  assert.match(home, /rtlLocales\.has\(activeLocale as Locale\)/);
  for (const source of selectors) for (const locale of addedLocales) assert.match(source, new RegExp(`(?:value=\\"${locale}\\"|\\"${locale}\\")`));
});
