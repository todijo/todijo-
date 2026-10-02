import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { categoryGroupImagePath } from "../lib/category-group-artwork";
import { DESKTOP_CATEGORY_TAXONOMY, subcategoryImagePath } from "../lib/desktop-category-taxonomy";

test("only the configured furniture group resolves artwork and a failed image falls back to text", () => {
  const src = "/images/category-groups/home--furniture.webp";
  assert.equal(categoryGroupImagePath("home", "furniture"), src);
  assert.equal(categoryGroupImagePath("home", "furniture", src), null);
  assert.equal(categoryGroupImagePath("home", "furniture", "/other.webp"), src);
  for (const category of DESKTOP_CATEGORY_TAXONOMY) {
    for (const group of category.groups) {
      if (category.id !== "home" || group.id !== "furniture") {
        assert.equal(categoryGroupImagePath(category.id, group.id), null);
      }
    }
  }
  assert.equal(categoryGroupImagePath("unknown", "unknown"), null);
});

test("all nineteen approved furniture assets decode as distinct 168-square WebP images", async () => {
  const group = DESKTOP_CATEGORY_TAXONOMY.find(category => category.id === "home")!.groups.find(group => group.id === "furniture")!;
  const paths = [categoryGroupImagePath("home", "furniture")!, ...group.items.map(label => subcategoryImagePath("home", "furniture", label))];
  assert.equal(paths.length, 19);
  const hashes = new Set<string>();
  for (const path of paths) {
    const bytes = readFileSync(`public${path}`);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp", path);
    assert.equal(metadata.width, 168, path);
    assert.equal(metadata.height, 168, path);
    const decoded = await sharp(bytes).raw().toBuffer();
    assert.ok(decoded.length >= 168 * 168 * 3, path);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 19, "The group asset and every leaf have dedicated artwork");
  assert.equal(subcategoryImagePath("home", "storage", "Meubles"), "/images/mobile-subcategories/home--storage--meubles.webp");
});

test("both existing navigation headings use the optional image with accessible RTL-safe failure handling", () => {
  for (const path of ["components/BuyerMobileNavigation.tsx", "components/MarketplaceCategoryNavigation.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /<h3><CategoryGroupImage[^>]+groupId=\{group.id\}/);
    assert.match(source, /localizedFurnitureCategoryLabel\(group.label, locale\) \?\? localizedCategoryGroupLabel/);
  }
  const image = readFileSync("components/CategoryGroupImage.tsx", "utf8");
  assert.match(image, /if \(!src\) return null/);
  assert.match(image, /onError=\{\(\) => setFailedSrc\(src\)\}/);
  assert.match(image, /alt="" aria-hidden="true"/);
  assert.match(image, /marginInlineEnd: 8/);
});
