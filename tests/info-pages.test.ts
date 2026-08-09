import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const locales = ["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"];
const slugs = ["about", "how-it-works", "mission", "help", "how-to-buy", "how-to-sell", "delivery", "safety", "seller-guide", "contact", "support", "report-problem"];

test("public information pages have complete localized content in every locale", () => {
  for (const locale of locales) {
    const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "info-pages", `${locale}.json`), "utf8")) as { relatedTitle: string; pages: Record<string, { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string }> }> };
    assert.ok(data.relatedTitle.trim(), locale);
    assert.deepEqual(Object.keys(data.pages).sort(), [...slugs].sort(), locale);
    for (const slug of slugs) {
      const page = data.pages[slug];
      assert.ok(page.eyebrow.trim() && page.title.trim() && page.intro.trim(), `${locale}/${slug}`);
      assert.ok(page.sections.length >= 2, `${locale}/${slug}`);
      assert.ok(page.sections.every((section) => section.title.trim() && section.body.trim()), `${locale}/${slug}`);
      assert.doesNotMatch(`${page.intro} ${page.sections.map((section) => section.body).join(" ")}`, /coming soon|bientôt disponible/i, `${locale}/${slug}`);
    }
  }
});

test("information route keeps completed legal returns policy separate", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "info", "[slug]", "page.tsx"), "utf8");
  assert.match(source, /const policyKinds = \{ terms: "terms", "seller-terms": "seller", returns: "returns" \}/);
  assert.doesNotMatch(source, /publicInfoSlugs = \[[^\]]*"returns"/);
});
