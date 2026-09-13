import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("premium identity defines reusable forest cream and rich-gold tokens", () => {
  const css = read("app/globals.css");
  for (const token of ["--todijo-forest", "--todijo-forest-deep", "--todijo-cream", "--todijo-ivory", "--todijo-gold", "--todijo-gold-dark"]) {
    assert.match(css, new RegExp(`${token}:`));
  }
  assert.match(css, /--todijo-gold:#c59618/);
  assert.match(css, /:where\(a,button,input,select,textarea,summary\):focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("premium presentation covers marketplace product dashboards and information pages", () => {
  const css = read("app/globals.css");
  for (const selector of [".marketPrimaryHeader", ".premiumHeroSlider", ".marketFilterDock", ".productDetailPage", ".premiumDashboard", ".adminPage", ".marketplaceFooter", ".marketInfoPage"]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }
});

test("homepage sections avoid new-arrival and best-seller repetition without static merchandising", () => {
  const home = read("app/HomeClient.tsx");
  assert.match(home, /uniqueProductsById\(newArrivals\)\.filter\(\(product\) => !bestSellerIds\.has\(product\.id\)\)/);
  assert.match(home, /visibleProducts\.filter\(\(product\) => !featuredRailIds\.has\(product\.id\)\)/);
  assert.doesNotMatch(home, /const\s+(?:newArrivals|bestSellers)\s*=\s*\[/);
});

test("footer destinations stay in normal full-page navigation", () => {
  const footer = read("components/MarketplaceFooter.tsx");
  assert.doesNotMatch(footer, /target="_blank"/);
  assert.match(read("app/info/[slug]/page.tsx"), /className={`marketInfoPage scopedPublicPage/);
});

test("visual preview fixtures are rejected before rendering in production", () => {
  const preview = read("app/e2e-ux/page.tsx");
  assert.match(preview, /if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/);
  assert.ok(preview.indexOf('if (process.env.NODE_ENV === "production") notFound();') < preview.indexOf('if(view==="premium-product-detail")'));
  assert.doesNotMatch(read("app/e2e-ux/UnseenAreaPreviews.tsx"), /prisma\.|readSession\(|setCookie\(/);
});
