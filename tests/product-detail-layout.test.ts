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

test("mobile product gallery has no floating actions and keeps a live counter", async () => {
  const [page, gallery] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/product/[id]/ProductGallery.tsx", "utf8")]);
  assert.ok(page.indexOf("productGallery productGallerySticky") < page.indexOf("productDetailInfo"));
  assert.doesNotMatch(page, /className="productGalleryActions"/);
  assert.match(page, /<WishlistButton productId=\{product\.id\}/);
  assert.match(page, /<ShareButton title=\{product\.name\}/);
  assert.match(gallery, /className="productGalleryCounter"[^>]*>\{selectedIndex \+ 1\} \/ \{cleanImages\.length\}/);
  assert.match(gallery, /!isMobileGallery && cleanImages\.length > 1/);
  assert.match(gallery, /window\.matchMedia\("\(max-width: 860px\)"\)/);
  assert.match(gallery, /openerRef\.current = event\.currentTarget;[\s\S]*?setIsOpen\(true\)/);
  assert.match(page, /className="productMobileSecondaryActions"><ShareButton title=\{product\.name\}/);
  assert.doesNotMatch(page, /productMobileSecondaryActions[^\n]*WishlistButton/);
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

test("Product Detail uses the shared mobile shell and a portrait mobile gallery", async () => {
  const [page, siteHeader, css] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("components/SiteHeader.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(page, /<SiteHeader storeName=\{product\.store\.name\}/);
  assert.match(siteHeader, /<BuyerMobileHeader accountName=\{accountName\}\/>/);
  assert.match(css, /\.buyerMobileShellHeader~\.marketHeader,\.buyerMobileShellHeader~\.siteHeader/);
  assert.match(css, /\.productMobileImageTrack\{[^}]*width:100%;aspect-ratio:4\/5;[^}]*overflow-x:auto;[^}]*scroll-behavior:smooth/);
  assert.match(css, /\.productMobileImageSlide\{[^}]*flex:0 0 100%;[^}]*height:100%;[^}]*justify-content:center;[^}]*overflow:hidden/);
  assert.match(css, /\.productMobileImageSlide img\{[^}]*width:100%;height:100%;[^}]*object-fit:cover;object-position:center/);
  assert.doesNotMatch(css, /\.productMobileImageTrack\{[^}]*min-height:/);
  assert.match(css, /\.productGalleryBack\{display:none!important\}/);
  assert.match(css, /\.productLightbox\{z-index:9999\}/);
});

test("mobile gallery removes the shell gap and uses a horizontal snap track", async () => {
  const [gallery, css] = await Promise.all([readFile("app/product/[id]/ProductGallery.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(css, /@media\(max-width:860px\)\{[\s\S]*?\.productDetailShell\{margin-top:0;padding-top:0\}/);
  assert.match(css, /\.productGallery\{top:auto;margin-top:0\}/);
  assert.match(css, /\.productGalleryInteractive\{position:relative;top:auto;/);
  assert.match(css, /\.productMobileImageTrack\{[^}]*display:flex;[^}]*overflow-x:auto;[^}]*scroll-snap-type:x mandatory/);
  assert.match(css, /touch-action:pan-x pan-y/);
  assert.match(css, /\.productMobileImageSlide\{[^}]*flex:0 0 100%;[^}]*scroll-snap-align:start;scroll-snap-stop:always/);
  assert.match(gallery, /isMobileGallery \? \(/);
  assert.match(gallery, /className="productMobileImageTrack"/);
  assert.match(gallery, /className="productMobileImageSlide"/);
  assert.match(gallery, /onScroll=\{\(\) =>/);
  assert.match(gallery, /Math\.round\(track\.scrollLeft \/ track\.clientWidth\)/);
  assert.match(gallery, /\[cleanImages\[cleanImages\.length - 1\], \.\.\.cleanImages, cleanImages\[0\]\]/);
  assert.match(gallery, /physicalIndex === cleanImages\.length \+ 1/);
  assert.match(gallery, /const destination = physicalIndex === 0 \? cleanImages\.length : 1/);
  assert.match(gallery, /track\.style\.scrollBehavior = "auto"/);
  assert.match(gallery, /jumpToPhysicalIndex\(destination\)/);
  assert.doesNotMatch(gallery, /onPointerDown=/);
  assert.doesNotMatch(css, /height:clamp\(340px,52svh,520px\)/);
  assert.doesNotMatch(css, /--active-gallery-height/);
  assert.match(css, /\.productZoomHint\{display:none\}/);
  assert.match(css, /\.productMobileSecondaryActions \.productIconButton\{min-width:44px;min-height:44px/);
});

test("gallery index, counter, and thumbnails stay synchronized", async () => {
  const gallery = await readFile("app/product/[id]/ProductGallery.tsx", "utf8");
  assert.match(gallery, /setSelectedIndex\(\(current\) => current === next \? current : next\)/);
  assert.match(gallery, /className="productGalleryCounter"[^>]*>\{selectedIndex \+ 1\} \/ \{cleanImages\.length\}/);
  assert.match(gallery, /index === selectedIndex \? " isActive" : ""/);
  assert.match(gallery, /setSelectedIndex\(index\); scrollToIndex\(index\)/);
  assert.match(gallery, /requestAnimationFrame\(\(\) => scrollToIndex\(0, "auto"\)\)/);
  assert.match(gallery, /setVariantImages\(Array\.isArray\(next\) \? next\.filter\(Boolean\) : \[\]\); setSelectedIndex\(0\)/);
  assert.doesNotMatch(gallery, /setTrackHeight|ResizeObserver|active-gallery-height/);
});

test("desktop gallery uses a large image with a vertical thumbnail rail and responsive fallback", async () => {
  const [gallery, css] = await Promise.all([readFile("app/product/[id]/ProductGallery.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.match(css, /@media\(min-width:1101px\)[\s\S]*?\.productGalleryInteractive\{display:grid;grid-template-columns:88px minmax\(0,1fr\);grid-template-rows:minmax\(560px,640px\)/);
  assert.match(css, /@media\(min-width:1101px\)[\s\S]*?\.productThumbs\{grid-column:1;grid-row:1;[^}]*flex-direction:column;[^}]*overflow-y:auto/);
  assert.match(css, /\.productMainImageButton\{grid-column:2;grid-row:1;position:relative;width:100%;height:100%;min-height:0;[^}]*border-radius:24px;[^}]*overflow:hidden/);
  assert.match(css, /\.productMainImage\.productMainImageIntrinsic\{display:block;width:100%;height:100%;max-height:none;margin:0;object-fit:contain;object-position:center\}/);
  assert.match(css, /@media\(min-width:861px\) and \(max-width:1100px\)[\s\S]*?\.productThumbs\{display:flex;[^}]*overflow-x:auto;overflow-y:hidden/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.productThumbButton\{transition:none\}\}/);
  assert.match(gallery, /index === selectedIndex \? " isActive" : ""/);
  assert.match(gallery, /onClick=\{\(\) => \{ setSelectedIndex\(index\); scrollToIndex\(index\); \}\}/);
});

test("mobile product info starts with compact title and price", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /@media\(max-width:860px\)\{\.productSellerLink,\.productTopMeta,\.productFactsDesktop,\.productFactsDesktopLink\{display:none\}/);
  assert.match(css, /\.productDetailInfo h1\{margin:0 0 7px;font-size:clamp\(20px,5\.5vw,22px\);line-height:1\.1\}/);
  assert.match(css, /\.productDetailPrice\{font-size:clamp\(22px,6vw,25px\)\}/);
});

test("mobile product facts follow Description while desktop facts keep their original placement", async () => {
  const [page, css] = await Promise.all([readFile("app/product/[id]/page.tsx", "utf8"), readFile("app/globals.css", "utf8")]);
  assert.ok(page.indexOf("productFactsDesktop") < page.indexOf("productDetailDescriptionSection"));
  assert.ok(page.indexOf("productDetailDescription") < page.indexOf("productFacts productFactsMobile"));
  assert.ok(page.indexOf("productFacts productFactsMobile") < page.indexOf("<AskSellerButton"));
  assert.match(css, /\.productFactsMobile,\.productFactsMobileLink\{display:none\}/);
  assert.match(css, /@media\(max-width:860px\)\{\.productSellerLink,\.productTopMeta,\.productFactsDesktop,\.productFactsDesktopLink\{display:none\}\.productFactsMobile,\.productFactsMobileLink\{display:flex\}/);
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
