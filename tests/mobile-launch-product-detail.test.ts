import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { minimumPurchasableVariantPrice } from "../lib/product-availability";

const source=(path:string)=>readFileSync(path,"utf8");

test("minimum price uses only complete active in-stock purchasable variants",()=>{
  const price=minimumPurchasableVariantPrice({basePrice:25,activeOptionCount:2,variants:[
    {active:true,stock:4,valueCount:2,priceOverride:21.5},
    {active:true,stock:3,valueCount:2,priceOverride:23},
    {active:true,stock:0,valueCount:2,priceOverride:5},
    {active:false,stock:9,valueCount:2,priceOverride:4},
    {active:true,stock:2,valueCount:1,priceOverride:3},
    {active:true,stock:2,valueCount:2,priceOverride:0},
  ]});
  assert.equal(price,21.5);
  assert.equal(minimumPurchasableVariantPrice({basePrice:25,activeOptionCount:1,variants:[{active:false,stock:1,valueCount:1,priceOverride:10}]}),null);
});

test("launch branding relies on the native PWA splash without a delayed JavaScript overlay",()=>{
  const layout=source("app/layout.tsx"),manifest=source("app/manifest.ts"),worker=source("public/sw.js");
  assert.doesNotMatch(layout,/TodijoLaunchSplash/);
  assert.match(manifest,/background_color: "#fffaf0"/);
  assert.match(manifest,/icon-maskable-512\.png\?v=6/);
  assert.match(worker,/CACHE_VERSION = "mobile-brand-v6"/);
});

test("PWA startup icons use the centered square derivative of the supplied Todijo artwork",()=>{
  const icons=[
    ["public/icon-192.png",192,"7e880cea052e50b627887fa13946ca77eb718e72dd54f29af0d54f4cc1bca6da"],
    ["public/icon-512.png",512,"6cf80f6495cbf2da4281c9b7fae51a47fb4c3b91e2aa6239b1eeb2858aae64e0"],
    ["public/icon-maskable-512.png",512,"6cf80f6495cbf2da4281c9b7fae51a47fb4c3b91e2aa6239b1eeb2858aae64e0"],
    ["public/apple-icon.png",180,"d4d2f34958af850a52c970de292ff85f0c562410b1406e55c2ef06440eaeb9ee"],
  ] as const;
  for(const [path,size,sha256] of icons){
    const png=readFileSync(path);
    assert.equal(png.readUInt32BE(16),size,path);
    assert.equal(png.readUInt32BE(20),size,path);
    assert.equal(createHash("sha256").update(png).digest("hex"),sha256,path);
  }
});

test("umbrella identity, exact default title and install icons are wired",()=>{
  const mark=source("components/TodijoUmbrellaMark.tsx"),layout=source("app/layout.tsx"),manifest=source("app/manifest.ts");
  assert.match(mark,/>To<\/text>/);assert.match(mark,/>Di<\/text>/);assert.match(mark,/>Jo<\/text>/);
  assert.match(mark,/umbrellaPanelLeft/);assert.match(mark,/umbrellaPanelCenter/);assert.match(mark,/umbrellaPanelRight/);assert.match(mark,/umbrellaShaft/);
  assert.match(layout,/default: "Todijo Marketplace"/);
  for(const path of ["public/favicon.ico","public/apple-icon.png","public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png"])assert.equal(existsSync(path),true,path);
  assert.equal(existsSync("app/icon.svg"),false);
  for(const icon of ["icon-192.png","icon-512.png","icon-maskable-512.png"])assert.match(manifest,new RegExp(icon.replace(".","\\.")));
  assert.doesNotMatch(manifest,/apple-icon|favicon|icon\.svg/);
  assert.match(layout,/apple-icon\.png\?v=6/);
  assert.doesNotMatch(layout,/icon\.svg|favicon\.ico|apple-icon\.png\?v=4/);
});

test("pricing failures terminate with a retry without exposing stale source-currency prices",()=>{
  const card=source("components/AuthoritativeProductCardPrice.tsx"),detail=source("app/product/[id]/ProductDetailPrice.tsx"),quote=source("components/DropshippingProductPricing.tsx");
  assert.match(card,/status:"error",price:null/);assert.match(card,/state\.status==="ready"\?formatCurrency[\s\S]*priceSkeleton/);assert.match(card,/productPriceUi\[locale\]\.retry/);assert.match(card,/setRetry\(value=>value\+1\)/);assert.doesNotMatch(card,/from\(minimum\)/);
  assert.match(detail,/useLayoutEffect/);assert.match(detail,/pendingPresentment\?"…"/);assert.match(detail,/detail\.verified===true/);
  assert.match(quote,/state\.status==="error"/);assert.match(quote,/productPriceUi\[locale\]\.retry/);assert.match(quote,/setRetry\(value=>value\+1\)/);
});

test("mobile sticky purchase bar contains only the accessible one-shot cart action",()=>{
  const panel=source("components/ProductPurchasePanel.tsx"),button=source("components/AddToCartButton.tsx"),css=source("app/globals.css");
  const bar=panel.match(/<div className="mobilePurchaseBar">([\s\S]*?)<\/div>\s*<\/aside>/)?.[1]??"";
  assert.match(bar,/<AddToCartButton compact/);assert.doesNotMatch(bar,/mobilePurchaseThumb|mobilePurchaseSummary|<span|<strong|<Image/);
  assert.match(button,/compactCartIcon/);assert.match(button,/className="srOnly"/);assert.match(button,/aria-label=/);assert.match(button,/\|\| added/);
  assert.doesNotMatch(css,/\.mobilePurchaseThumb|\.mobilePurchaseSummary/);assert.match(css,/\.addCartButton\.isCompact\{[^}]*min-height:52px/);
  assert.match(css,/\.addCartButton\.isCompact:disabled/);assert.match(css,/@media\(max-width:760px\)/);
  assert.match(button,/compact \? /);assert.match(button,/ : disabled \|\| product\.stock === 0 \?/);
});

test("the selected large gallery image remains sticky, visible and uncropped on mobile only",()=>{
  const gallery=source("app/product/[id]/ProductGallery.tsx"),panel=source("components/ProductPurchasePanel.tsx"),css=source("app/globals.css");
  assert.match(panel,/new CustomEvent\("todijo:variant-images"/);assert.match(gallery,/addEventListener\("todijo:variant-images"/);
  assert.match(css,/@media\(max-width:860px\)[\s\S]*\.productGallerySticky\{position:sticky!important/);
  assert.match(css,/\.productGallerySticky \.productGalleryInteractive\{height:clamp\(240px,42dvh,420px\)/);
  assert.match(css,/\.productGallerySticky \.productMobileImageSlide img\{[^}]*object-fit:contain!important/);
  assert.match(css,/@media\(max-width:860px\) and \(max-height:500px\)/);
  assert.match(css,/@media\(min-width:1201px\)[\s\S]*\.productGallerySticky,\.productPurchaseColumn\{position:sticky/);
});

test("old dark-green public skeleton is replaced without changing its dimensions",()=>{
  const css=source("app/globals.css");
  assert.doesNotMatch(css,/\.pageSkeleton\{background:#0d1714\}/);
  assert.match(css,/\.pageSkeleton\{background:#171126\}/);
  assert.match(css,/\.pageSkeleton\.is-detail article\{min-height:360px\}/);
});
