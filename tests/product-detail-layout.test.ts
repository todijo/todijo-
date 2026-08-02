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

test("mobile product gallery is first with accessible overlay actions and a live counter", async () => {
  const [page, gallery, css] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/product/[id]/ProductGallery.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.ok(page.indexOf("productGallery productGallerySticky") < page.indexOf("productDetailInfo"));
  assert.match(page, /className="productGalleryActions"/);
  assert.match(page, /className="productGalleryBack"[^>]*aria-label=\{common\("back"\)\}/);
  assert.match(page, /<WishlistButton productId=\{product\.id\}/);
  assert.match(page, /<ShareButton title=\{product\.name\}/);
  assert.match(gallery, /className="productGalleryCounter"[^>]*>\{selectedIndex \+ 1\} \/ \{cleanImages\.length\}/);
  assert.match(css, /@media\(max-width:760px\)[^\n]*\.productGalleryActions\{position:absolute;[^}]*display:flex/);
  assert.match(css, /\.productGalleryActions a,\.productGalleryActions button\{[^}]*width:44px;height:44px/);
});

test("mobile purchase bar keeps one visible primary action and safe content clearance", async () => {
  const [purchase, css] = await Promise.all([readFile("components/ProductPurchasePanel.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(purchase, /className="mobilePurchaseBar"/);
  assert.match(purchase, /selectedOptions \|\| detail\("chooseCombination"\)/);
  assert.match(css, /\.variantPurchasePanel>\.addCartButton\{display:none\}/);
  assert.match(css, /\.mobilePurchaseBar\{position:fixed;[^}]*bottom:0;[^}]*safe-area-inset-bottom/);
  assert.match(css, /\.productDetailPage\{[^}]*padding-bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.mobilePurchaseBar \.addCartButton\{min-height:52px/);
  assert.match(css, /\.mobilePurchaseBar\{bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\);padding-bottom:9px\}/);
});

test("Product Detail uses the shared mobile shell and a bounded natural gallery", async () => {
  const [page, siteHeader, css] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("components/SiteHeader.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(page, /<SiteHeader storeName=\{product\.store\.name\}/);
  assert.match(siteHeader, /<BuyerMobileHeader accountName=\{accountName\}\/>/);
  assert.match(css, /\.buyerMobileShellHeader~\.marketHeader,\.buyerMobileShellHeader~\.siteHeader/);
  assert.match(css, /\.productMainImageSlide\{[^}]*height:auto/);
  assert.match(css, /\.productMainImageSlide \.productMainImageIntrinsic\{[^}]*width:100%;height:auto;max-height:min\(56svh,480px\)/);
  assert.match(css, /\.productGalleryBack\{display:none!important\}/);
  assert.match(css, /\.productLightbox\{z-index:9999\}/);
});

test("mobile gallery removes the shell gap and uses a horizontal snap track", async () => {
  const [gallery, css] = await Promise.all([readFile("app/product/[id]/ProductGallery.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(css, /@media\(max-width:860px\)\{[\s\S]*?\.productDetailShell\{margin-top:0;padding-top:0\}/);
  assert.match(css, /\.productGallery\{top:auto;margin-top:0\}/);
  assert.match(css, /\.productGalleryInteractive\{position:relative;top:auto;/);
  assert.match(css, /\.productMainImageTrack\{[^}]*display:flex;[^}]*overflow-x:auto;[^}]*scroll-snap-type:x mandatory/);
  assert.match(css, /touch-action:pan-y pinch-zoom/);
  assert.match(css, /\.productMainImageSlide\{[^}]*flex:0 0 100%;[^}]*scroll-snap-align:start;scroll-snap-stop:always/);
  assert.match(css, /@media\(min-width:861px\)\{\.productMainImageTrack\{overflow:visible\}\.productMainImageSlide\{display:none\}\.productMainImageSlide\.isActive\{display:block\}\}/);
  assert.match(gallery, /productMainImageSlide\$\{index === selectedIndex \? " isActive" : ""\}/);
  assert.match(gallery, /onScroll=\{\(\) =>/);
  assert.match(gallery, /Math\.round\(track\.scrollLeft \/ track\.clientWidth\)/);
  assert.match(gallery, /onPointerDown=/);
  assert.match(gallery, /Math\.abs\(event\.clientX - start\.x\) > 12/);
  assert.doesNotMatch(css, /height:clamp\(340px,52svh,520px\)/);
  assert.match(css, /height:var\(--active-gallery-height,auto\);max-height:min\(56svh,480px\)/);
});

test("gallery index, counter, and thumbnails stay synchronized", async () => {
  const gallery = await readFile("app/product/[id]/ProductGallery.tsx", "utf8");
  assert.match(gallery, /setSelectedIndex\(\(current\) => current === next \? current : next\)/);
  assert.match(gallery, /className="productGalleryCounter"[^>]*>\{selectedIndex \+ 1\} \/ \{cleanImages\.length\}/);
  assert.match(gallery, /index === selectedIndex \? " isActive" : ""/);
  assert.match(gallery, /setSelectedIndex\(index\); scrollToIndex\(index\)/);
  assert.match(gallery, /requestAnimationFrame\(\(\) => scrollToIndex\(0, "auto"\)\)/);
  assert.match(gallery, /slideRefs\.current\[index\]\?\.offsetHeight/);
  assert.match(gallery, /--active-gallery-height/);
});

test("mobile product sections remain contained while desktop composition is unchanged", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.productDetailShell\{width:100%;padding:0 0 32px\}/);
  assert.match(css, /\.optionGroup>div\{max-width:100%;[^}]*overflow-x:auto/);
  assert.match(css, /\.reviewsGrid\{grid-template-columns:1fr;gap:12px\}/);
  assert.match(css, /\.relatedGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:9px\}/);
  assert.match(css, /\.productDetailTop\{grid-template-columns:minmax\(0,1\.16fr\) minmax\(300px,\.9fr\) minmax\(280px,\.72fr\)/);
  assert.match(css, /\.productDetailPage\{overflow-x:clip/);
});

test("quantity and review states retain their real-data boundaries", async () => {
  const [purchase, reviews, page] = await Promise.all([readFile("components/ProductPurchasePanel.tsx", "utf8"), readFile("components/ReviewSection.tsx", "utf8"), readFile("app/product/[id]/page.tsx", "utf8")]);
  assert.match(purchase, /Math\.max\(1, value - 1\)/);
  assert.match(purchase, /Math\.min\(stock, value \+ 1\)/);
  assert.match(purchase, /disabled=\{!available \|\| quantity >= stock\}/);
  assert.match(reviews, /data\.reviews\.length===0/);
  assert.match(reviews, /data\.reviews\.map/);
  assert.match(page, /category:product\.category,id:\{not:product\.id\}/);
});
