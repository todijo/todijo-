import test from "node:test";
import assert from "node:assert/strict";
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

test("cold mobile splash is session-scoped, reduced-motion aware and bounded",()=>{
  const splash=source("components/TodijoLaunchSplash.tsx"),css=source("app/globals.css");
  assert.match(splash,/todijo-mobile-splash-seen-v1/);
  assert.match(splash,/matchMedia\("\(max-width: 860px\)"\)/);
  assert.match(splash,/sessionStorage\.getItem/);assert.match(splash,/sessionStorage\.setItem/);
  assert.match(splash,/prefers-reduced-motion: reduce/);
  assert.match(splash,/useState\(true\)/);assert.match(splash,/reduced \? 120 : DISPLAY_MS/);assert.match(splash,/DISPLAY_MS = 650/);assert.match(splash,/FALLBACK_MS = 900/);
  assert.match(splash,/aria-hidden="true"/);assert.match(css,/\.todijoLaunchSplash\{[^}]*pointer-events:none/);
  const splashCss=css.slice(css.indexOf("/* Cold mobile launch branding"));
  assert.match(css,/html \{[^}]*background:#16074c/);assert.match(splashCss,/background:radial-gradient\([^}]*#32108a[^}]*#16074c[^}]*#090529/);
  assert.doesNotMatch(splashCss,/#0d1714|#063a2c|#07553e/);
  assert.match(css,/\.todijoLaunchMark\{width:min\(82vw,380px\)/);assert.match(css,/todijo-canopy-open 1\.8s/);assert.match(css,/animation:todijo-splash-exit \.65s/);
});

test("umbrella identity, exact default title and install icons are wired",()=>{
  const mark=source("components/TodijoUmbrellaMark.tsx"),layout=source("app/layout.tsx"),manifest=source("app/manifest.ts");
  assert.match(mark,/>To<\/text>/);assert.match(mark,/>Di<\/text>/);assert.match(mark,/>Jo<\/text>/);
  assert.match(mark,/umbrellaPanelLeft/);assert.match(mark,/umbrellaPanelCenter/);assert.match(mark,/umbrellaPanelRight/);assert.match(mark,/umbrellaShaft/);
  assert.match(layout,/default: "Todijo Marketplace"/);
  for(const path of ["app/icon.svg","public/favicon.ico","public/apple-icon.png","public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png"])assert.equal(existsSync(path),true,path);
  for(const icon of ["icon-192.png","icon-512.png","icon-maskable-512.png","apple-icon.png"])assert.match(manifest,new RegExp(icon.replace(".","\\.")));
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
