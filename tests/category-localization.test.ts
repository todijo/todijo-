import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { categoryKey, categoryLabel, PRODUCT_CATEGORIES } from "../lib/categories";
import { locales } from "../i18n/config";

const root = process.cwd();
const translations = (locale: string) => JSON.parse(fs.readFileSync(path.join(root, "messages/categories", `${locale}.json`), "utf8")) as Record<string, string>;

test("category aliases resolve to stable display keys without changing canonical values", () => {
  assert.equal(categoryKey("Beauté"), "beauty");
  assert.equal(categoryKey("beaute"), "beauty");
  assert.equal(categoryKey("BEAUTÉ"), "beauty");
  assert.equal(categoryKey("Électronique"), "electronics");
  assert.equal(categoryKey("vehicules"), "auto");
  assert.equal(categoryLabel("legacy_category", (key) => key), "legacy category");
  assert.deepEqual(PRODUCT_CATEGORIES.map(({ value }) => value), ["Mode", "Électronique", "Maison", "Beauté", "Sports", "Livres", "Enfants", "Auto", "Artisanat", "Autre"]);
});

test("all supported locales have exact category-key parity and natural Chinese labels", () => {
  const expected = PRODUCT_CATEGORIES.map(({ key }) => key).sort();
  for (const locale of locales) {
    const file = path.join(root, "messages/categories", `${locale}.json`);
    assert.ok(fs.existsSync(file), `Missing category translations for ${locale}`);
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\uFFFD|Ã|Â|â€|ðŸ|Ø|Ù|Ú/);
    assert.deepEqual(Object.keys(JSON.parse(source)).sort(), expected);
  }
  assert.deepEqual(translations("zh"), {
    fashion: "时尚", electronics: "电子产品", home: "家居", beauty: "美妆", sports: "运动",
    books: "图书", children: "儿童", auto: "汽车", crafts: "手工艺", other: "其他",
  });
});

test("visible category surfaces use the shared resolver while values and queries stay canonical", () => {
  const home = fs.readFileSync(path.join(root, "app/HomeClient.tsx"), "utf8");
  const detail = fs.readFileSync(path.join(root, "app/product/[id]/page.tsx"), "utf8");
  const store = fs.readFileSync(path.join(root, "app/store/[slug]/StoreExperience.tsx"), "utf8");
  const productCard = fs.readFileSync(path.join(root, "components/MarketplaceProductCard.tsx"), "utf8");
  const create = fs.readFileSync(path.join(root, "app/seller/products/new/NewProductForm.tsx"), "utf8");
  const edit = fs.readFileSync(path.join(root, "app/seller/products/[id]/edit/EditProductForm.tsx"), "utf8");
  const selector = fs.readFileSync(path.join(root, "components/SellerCategorySelector.tsx"), "utf8");
  assert.match(home, /const displayCategory = .*categoryLabel/);
  assert.match(home, /categoryShowcaseGrid[^\n]+categories\.slice\(0,8\)\.map/);
  assert.match(home, /<strong>\{displayCategory\(category\)\}<\/strong>/);
  assert.match(home, /chooseCategory\(category\)/);
  assert.match(detail, /categoryLabel\(product\.category/);
  assert.match(store, /<MarketplaceProductCard[^>]+showCategory/);
  assert.match(productCard, /categoryLabel\(product\.category/);
  for (const source of [create, edit]) {
    assert.match(source, /SellerCategorySelector/);
    assert.doesNotMatch(source, /PRODUCT_CATEGORIES/);
  }
  assert.match(selector, /DESKTOP_CATEGORY_TAXONOMY\.map/);
  assert.match(selector, /name="category"/);
  assert.match(fs.readFileSync(path.join(root, "app/page.tsx"), "utf8"), /category: \{ contains: q/);
  assert.match(fs.readFileSync(path.join(root, "lib/marketplace-search.ts"), "utf8"), /\["category", normalizedFilters\.category\]/);
});
