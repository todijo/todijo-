import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("homepage keeps filters and every category before the five-product hero mosaic", () => {
  const home = source("app/HomeClient.tsx");
  const filters = home.indexOf("<MarketplaceFilterDock");
  const categories = home.indexOf("<MarketplaceCategoryNavigation");
  const hero = home.indexOf('className="discoveryHero"');
  assert.ok(filters >= 0 && categories > filters && hero > categories);
  assert.match(home, /heroProducts\.filter\(\(product\) => product\.image\)\.slice\(0, 5\)/);
  assert.doesNotMatch(home.slice(hero, home.indexOf("</section>", hero)), /storeName/);

  const page = source("app/page.tsx");
  assert.match(page, /Math\.floor\(Math\.random\(\) \* \(heroProductCount - heroTake \+ 1\)\)/);
  assert.match(page, /take: heroTake/);
  assert.doesNotMatch(page, /heroRows[\s\S]{0,300}orderBy:\s*\{\s*createdAt:\s*["']desc["']/);
});

test("category rail exposes the complete taxonomy with accessible smooth controls", () => {
  const navigation = source("components/MarketplaceCategoryNavigation.tsx");
  assert.match(navigation, /DESKTOP_CATEGORY_TAXONOMY\.map/);
  assert.doesNotMatch(navigation, /DESKTOP_CATEGORY_TAXONOMY\.slice/);
  assert.match(navigation, /className="marketCategoryScrollButton previous"[^\n]+aria-label=/);
  assert.match(navigation, /className="marketCategoryScrollButton next"[^\n]+aria-label=/);
  assert.match(navigation, /scrollBy\(\{ left: direction \* Math\.max\(280, railRef\.current\.clientWidth \* 0\.72\), behavior: "smooth" \}\)/);
  assert.match(navigation, /event\.key === "Escape"/);
});

test("Violet Royal surfaces and dark seller compliance labels retain contrast", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.marketplaceFooter\{[^}]*background:linear-gradient\([^}]*#24103f/);
  assert.match(css, /\.mobileAppPromotionGrid\{[^}]*#24103f/);
  assert.match(css, /\.premiumDashboardSidebar\.isSeller\{[^}]*#2b0d52/);
  assert.match(css, /\.adminHero\{[^}]*#35106f/);
  assert.match(css, /\.sellerControlForm \.productComplianceFields label[^}]*color:#fff/);
  assert.match(css, /\.sellerControlForm \.productComplianceFields input,\.sellerControlForm \.productComplianceFields textarea\{[^}]*color:#24183b/);
});

test("hero layout has one dominant tile and four compact responsive slots", () => {
  const css = source("app/globals.css");
  assert.match(css, /\.heroProductCard:first-child\{[^}]*grid-row:1\/-1/);
  for (const index of [2, 3, 4, 5]) assert.match(css, new RegExp(`\\.heroProductCard:nth-child\\(${index}\\)`));
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.heroProductCollage/);
});
