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
  assert.match(splash,/reduced \? 280 : 1450/);assert.match(splash,/FALLBACK_MS = 1900/);
  assert.match(splash,/aria-hidden="true"/);assert.match(css,/\.todijoLaunchSplash\{[^}]*pointer-events:none/);
});

test("umbrella identity, exact default title and install icons are wired",()=>{
  const mark=source("components/TodijoUmbrellaMark.tsx"),layout=source("app/layout.tsx"),manifest=source("app/manifest.ts");
  assert.match(mark,/>To<\/text>/);assert.match(mark,/>Di<\/text>/);assert.match(mark,/>Jo<\/text>/);
  assert.match(mark,/umbrellaPanelLeft/);assert.match(mark,/umbrellaPanelCenter/);assert.match(mark,/umbrellaPanelRight/);assert.match(mark,/umbrellaShaft/);
  assert.match(layout,/default: "Todijo Marketplace"/);
  for(const path of ["app/icon.svg","public/favicon.ico","public/apple-icon.png","public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png"])assert.equal(existsSync(path),true,path);
  for(const icon of ["icon-192.png","icon-512.png","icon-maskable-512.png","apple-icon.png"])assert.match(manifest,new RegExp(icon.replace(".","\\.")));
});

test("pricing failures terminate with a retry while the last safe minimum remains visible",()=>{
  const card=source("components/AuthoritativeProductCardPrice.tsx"),detail=source("app/product/[id]/ProductDetailPrice.tsx"),quote=source("components/DropshippingProductPricing.tsx");
  assert.match(card,/productPriceUi\[locale\]\.from\(minimum\)/);assert.doesNotMatch(card,/Common.*loading|common\("loading"\)/);
  assert.match(detail,/useLayoutEffect/);assert.match(detail,/initialMinimum/);assert.match(detail,/detail\.verified===true/);
  assert.match(quote,/state\.status==="error"/);assert.match(quote,/productPriceUi\[locale\]\.retry/);assert.match(quote,/setRetry\(value=>value\+1\)/);
});

test("mobile purchase companion follows the selected image and retains an accessible one-shot cart action",()=>{
  const panel=source("components/ProductPurchasePanel.tsx"),button=source("components/AddToCartButton.tsx"),css=source("app/globals.css");
  assert.match(panel,/setSelectedImage\(images\[0\]\?\?product\.image\)/);assert.match(panel,/IntersectionObserver/);
  assert.match(panel,/mobilePurchaseThumb/);assert.match(panel,/<AddToCartButton compact/);
  assert.match(button,/compactCartIcon/);assert.match(button,/className="srOnly"/);assert.match(button,/aria-label=/);assert.match(button,/\|\| added/);
  assert.match(css,/\.mobilePurchaseThumb img\{[^}]*object-fit:contain/);assert.match(css,/\.addCartButton\.isCompact\{[^}]*min-height:52px/);
  assert.match(css,/\.addCartButton\.isCompact:disabled/);assert.match(css,/@media\(max-width:760px\)/);
  assert.match(button,/compact \? /);assert.match(button,/ : disabled \|\| product\.stock === 0 \?/);
});

test("old dark-green public skeleton is replaced without changing its dimensions",()=>{
  const css=source("app/globals.css");
  assert.doesNotMatch(css,/\.pageSkeleton\{background:#0d1714\}/);
  assert.match(css,/\.pageSkeleton\{background:#171126\}/);
  assert.match(css,/\.pageSkeleton\.is-detail article\{min-height:360px\}/);
});
