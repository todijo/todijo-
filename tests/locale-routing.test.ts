import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { locales } from "../i18n/config";
import { buildLocalizedPath, canonicalizeNestedLocalePath } from "../lib/locale-routing";

const switcherSource = fs.readFileSync(path.join(process.cwd(), "components/LanguageSwitcher.tsx"), "utf8");

test("switching locale replaces the current locale instead of appending it", () => {
  assert.equal(buildLocalizedPath("/nl", "es"), "/es");
  assert.equal(buildLocalizedPath("/fr/products/123", "en"), "/en/products/123");
  assert.equal(buildLocalizedPath("/ar/cart", "ku", "source=menu"), "/ku/cart?source=menu");
});

test("homepage, product, cart, and account routes preserve their remaining path", () => {
  assert.equal(buildLocalizedPath("/fr", "nl"), "/nl");
  assert.equal(buildLocalizedPath("/nl/product/123", "es"), "/es/product/123");
  assert.equal(buildLocalizedPath("/es/cart", "de"), "/de/cart");
  assert.equal(buildLocalizedPath("/de/account/orders", "it"), "/it/account/orders");
});

test("every supported locale can switch to every other locale without nesting", () => {
  const consecutiveLocales = new RegExp(`/(${locales.join("|")})/(${locales.join("|")})(?:/|$)`);

  for (const current of locales) {
    for (const next of locales) {
      const result = buildLocalizedPath(`/${current}/product/123`, next, "ref=language");
      assert.equal(result, `/${next}/product/123?ref=language`);
      assert.doesNotMatch(result, consecutiveLocales);
    }
  }
});

test("already nested locale paths canonicalize to the last selected locale", () => {
  assert.equal(canonicalizeNestedLocalePath("/nl/es"), "/es");
  assert.equal(canonicalizeNestedLocalePath("/fr/en/product/123"), "/en/product/123");
  assert.equal(canonicalizeNestedLocalePath("/en/ar/ku/cart"), "/ku/cart");
  assert.equal(canonicalizeNestedLocalePath("/fr/cart"), null);
});

test("repeated language switching always replaces the active locale", () => {
  let current = "/fr";
  for (const next of ["ku", "en", "ar", "fr"] as const) {
    current = buildLocalizedPath(current, next);
    assert.equal(current, `/${next}`);
  }

  current = "/nl/product/123?source=menu";
  for (const next of ["es", "ku", "en"] as const) {
    const [pathname, search = ""] = current.split("?");
    current = buildLocalizedPath(pathname, next, search);
    assert.equal(current, `/${next}/product/123?source=menu`);
  }
});

test("the switcher uses canonical full navigation instead of rewritten SPA router state", () => {
  assert.match(switcherSource, /const path = buildLocalizedPath\(window\.location\.pathname,\s*next,\s*window\.location\.search,\s*window\.location\.hash\)/);
  assert.match(switcherSource, /const localizedUrl = new URL\(path,\s*window\.location\.origin\)\.href/);
  assert.match(switcherSource, /window\.location\.href = localizedUrl/);
  assert.match(switcherSource, /document\.cookie = `\$\{localeCookie\}=\$\{next\}/);
  assert.doesNotMatch(switcherSource, /router\.(?:push|replace)/);
});
