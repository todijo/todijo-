import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("product detail renders one full description below the bounded gallery grid", async () => {
  const source = await readFile("app/product/[id]/page.tsx", "utf8");
  assert.equal(source.match(/productDetailDescription/g)?.length, 2); // section and paragraph class names
  assert.ok(source.indexOf("productDetailTop") < source.indexOf("productDetailDescriptionSection"));
  assert.ok(source.indexOf("productGallerySticky") < source.indexOf("productDetailDescriptionSection"));
  assert.equal(source.match(/\{product\.description\}/g)?.length, 1);
});

test("shop wording and Ask Seller order match their actions", async () => {
  const source = await readFile("app/product/[id]/page.tsx", "utf8");
  assert.match(source, /detailText\("viewShop"\)/);
  assert.match(source, /href=\{`\/store\/\$\{product\.store\.slug\}`\}/);
  assert.ok(source.indexOf("productDetailDescription") < source.indexOf("<AskSellerButton"));
  assert.equal(source.match(/<AskSellerButton/g)?.length, 1);
});

test("long titles wrap and gallery stickiness is desktop-only", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.productDetailInfo h1\{font-size:clamp\(26px,2\.1vw,28px\);line-height:1\.1\}/);
  assert.match(css, /@media\(max-width:620px\)[^\n]*\.productDetailInfo h1\{font-size:clamp\(21px,5\.6vw,23px\)/);
  assert.match(css, /\.productGallerySticky\{position:sticky/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*?\.productGallerySticky\{position:static\}/);
  assert.match(css, /\.productMainImage\.productMainImageIntrinsic\{[^}]*width:100%;height:auto;[^}]*object-fit:contain/);
  assert.doesNotMatch(css, /\.productMainImage\.productMainImageIntrinsic\{[^}]*height:(?:clamp|[0-9]+px)/);
});

test("product detail uses three marketplace areas and stacks without fixed mobile cards", async () => {
  const [page, css] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(page, /productGallery productGallerySticky/);
  assert.match(page, /productDetailInfo/);
  assert.match(page, /productPurchaseColumn/);
  assert.match(css, /\.productDetailTop\{grid-template-columns:minmax\(0,1\.16fr\) minmax\(300px,\.9fr\) minmax\(280px,\.72fr\)/);
  assert.match(css, /@media\(max-width:1100px\)[^\n]*\.productGallerySticky,\.productPurchaseColumn\{position:static\}/);
  assert.match(css, /@media\(max-width:760px\)[^\n]*\.productDetailTop\{grid-template-columns:minmax\(0,1fr\)/);
});

test("product detail price and lightbox close behavior stay scoped", async () => {
  const [css, gallery] = await Promise.all([readFile("app/globals.css", "utf8"), readFile("app/product/[id]/ProductGallery.tsx", "utf8")]);
  assert.match(css, /\.productDetailPrice\{font-size:clamp\(24px,2vw,26px\)\}/);
  assert.match(css, /\.productLightboxToolbar \.productLightboxClose\{[^}]*position:fixed;[^}]*z-index:10001;[^}]*width:48px;height:48px/);
  assert.match(gallery, /aria-label=\{locale === "fr" \? "Fermer" : "Close"\}/);
  assert.match(gallery, /event\.key === "Escape"\) closeGallery\(\)/);
  assert.match(gallery, /requestAnimationFrame\(\(\) => openerRef\.current\?\.focus\(\)\)/);
  assert.match(gallery, /document\.body\.style\.overflow = "hidden"/);
  assert.match(gallery, /createPortal\(\(/);
  assert.match(gallery, /\), document\.body\)/);
});

test("legacy and variant image product detail paths remain present", async () => {
  const [page, gallery] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/product/[id]/ProductGallery.tsx", "utf8")]);
  assert.match(page, /images: true, colors: true, sizes: true/);
  assert.match(page, /imageAssignments/);
  assert.match(gallery, /addEventListener\("todijo:variant-images"/);
  assert.match(gallery, /variantImages\.length \? variantImages : baseImages/);
  assert.match(gallery, /productMainImage productMainImageIntrinsic/);
});

test("selected variant price has one live product-detail location", async () => {
  const [page, price, purchase] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/product/[id]/ProductDetailPrice.tsx", "utf8"), readFile("components/ProductPurchasePanel.tsx", "utf8")]);
  assert.match(page, /<ProductDetailPrice/);
  assert.match(price, /addEventListener\("todijo:variant-price"/);
  assert.match(purchase, /new CustomEvent\("todijo:variant-price"/);
  assert.doesNotMatch(purchase, /className="variantPrice"/);
});
