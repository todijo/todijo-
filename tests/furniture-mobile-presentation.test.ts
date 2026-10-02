import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { localizedFurnitureCategoryLabel, furnitureTaxonomyLabels } from "../i18n/furniture-taxonomy";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref, subcategoryId, subcategoryImagePath } from "../lib/desktop-category-taxonomy";

test("mobile furniture labels localize without changing canonical links, image paths or order", () => {
  const home = DESKTOP_CATEGORY_TAXONOMY.find(category => category.id === "home")!;
  const furniture = home.groups[0];
  assert.equal(furniture.id, "furniture");
  assert.deepEqual(home.groups.slice(1).map(group => group.id), ["crafts", "party", "textiles", "kitchen", "storage", "music"]);
  for (const locale of locales) {
    assert.equal(localizedFurnitureCategoryLabel(furniture.label, locale), furnitureTaxonomyLabels[locale][0]);
    furniture.items.forEach((label, index) => {
      const id = subcategoryId(home.id, furniture.id, label);
      assert.equal(localizedFurnitureCategoryLabel(id, locale), furnitureTaxonomyLabels[locale][index + 1]);
      assert.equal(new URL(categorySearchHref(locale, id), "https://todijo.test").searchParams.get("category"), id);
      assert.equal(subcategoryImagePath(home.id, furniture.id, label), `/images/mobile-subcategories/${id}.webp`);
    });
    assert.equal(localizedFurnitureCategoryLabel("home--storage--meubles", locale), null);
  }
  const source = readFileSync("components/BuyerMobileNavigation.tsx", "utf8");
  assert.match(source, /localizedFurnitureCategoryLabel\(group.label, locale\)/);
  assert.match(source, /localizedFurnitureCategoryLabel\(id, locale\) \?\? localizedCategoryLeafLabel/);
  assert.match(source, /href=\{categorySearchHref\(locale, id\)\}/);
});

test("mobile readability overrides are restricted to furniture and preserve the established tiles", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const additions = css.slice(css.indexOf("/* Furniture uses the existing tiles"), css.indexOf(".buyerMobileCategoriesButton svg:last-child"));
  assert.equal((additions.match(/\[data-furniture\]/g) ?? []).length, 6);
  assert.match(additions, /width:min\(19vw,84px,100%\);height:auto;aspect-ratio:1\/1/);
  assert.match(additions, /min-height:44px!important/);
  assert.match(additions, /display:block;overflow:visible;-webkit-line-clamp:unset;overflow-wrap:anywhere/);
  assert.match(additions, /h3>img\{flex-shrink:0\}/);
  assert.doesNotMatch(additions, /marketQuick|grid-template-columns|border-radius|font-size/);
  const source = readFileSync("components/BuyerMobileNavigation.tsx", "utf8");
  assert.match(source, /data-furniture=\{activeCategory.id === "home" && group.id === "furniture" \? "" : undefined\}/);
});
