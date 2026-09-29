import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
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

test("startup branding is a first-paint standalone-PWA layer without an arbitrary delay",()=>{
  const layout=source("app/layout.tsx"),layer=source("components/PwaStartupLayer.tsx"),css=source("app/globals.css"),manifest=source("app/manifest.ts"),worker=source("public/sw.js");
  assert.match(layout,/display-mode: standalone/);
  assert.match(layout,/navigator\.standalone === true/);
  assert.match(layout,/<PwaStartupLayer\/>/);
  assert.match(layout,/href="\/images\/brand\/todijo-pwa-startup\.png\?v=1" media="\(display-mode: standalone\)"/);
  assert.match(layer,/<source media="\(display-mode: standalone\)" srcSet="\/images\/brand\/todijo-pwa-startup\.png\?v=1"/);
  assert.match(layer,/requestAnimationFrame/);
  assert.match(layer,/await image\.decode\(\)/);
  assert.match(layer,/addEventListener\("load"/);
  assert.match(layer,/transitionend/);
  assert.doesNotMatch(layer,/setTimeout|setInterval/);
  assert.match(css,/\.pwaStartupLayer\{display:none\}/);
  assert.match(css,/html\.todijoStandaloneLaunch \.pwaStartupLayer/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.pwaStartupLayer img\{display:block;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;object-position:center;user-select:none\}/);
  assert.match(manifest,/background_color: "#fffaf0", theme_color: "#fffaf0"/);
  assert.match(manifest,/icon-maskable-512\.png\?v=11/);
  assert.match(worker,/CACHE_VERSION = "mobile-brand-v12"/);
  assert.match(worker,/todijo-pwa-startup\.png\?v=1/);
});

test("standalone startup uses the exact approved Todijo artwork",()=>{
  const path="public/images/brand/todijo-pwa-startup.png";
  const png=readFileSync(path);
  assert.equal(png.readUInt32BE(16),941);
  assert.equal(png.readUInt32BE(20),1672);
  assert.equal(createHash("sha256").update(png).digest("hex"),"24ce205c3bec68f9a126be82a6fe5be0e72a6e7bc830e76d14564b03e1005e96");
});

test("PWA startup icons use the centered square derivative of the supplied Todijo artwork",()=>{
  const icons=[
    ["public/icon-192.png",192,"408d29e5c0c21dde30cfd9fb15a76fbc0aa68754e0725e575b84e3437ee0ce57"],
    ["public/icon-512.png",512,"9754d4cedf8a8f1ec5646f3f43f8de09437de71244b924003c3e3a2aad13ff4e"],
    ["public/icon-maskable-512.png",512,"2385e7e0dcd8ea73a1cedaaa1c55b8f3ca3a401c2f530ec4ccf8e1a03773c329"],
    ["public/apple-icon.png",180,"b4bf1f1f9c3e6a83d046665e334746a875e64373ddcec29579bd379ca0324c65"],
  ] as const;
  for(const [path,size,sha256] of icons){
    const png=readFileSync(path);
    assert.equal(png.readUInt32BE(16),size,path);
    assert.equal(png.readUInt32BE(20),size,path);
    assert.equal(createHash("sha256").update(png).digest("hex"),sha256,path);
  }
});

test("PWA artwork fills the regular icon canvas while the maskable derivative stays in its safe zone",async()=>{
  async function bounds(path:string){
    const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let minX=info.width,minY=info.height,maxX=-1,maxY=-1,maxRadius=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const offset=(y*info.width+x)*info.channels;
      const r=data[offset],g=data[offset+1],b=data[offset+2];
      const saturation=Math.max(r,g,b)-Math.min(r,g,b);
      const luminance=.2126*r+.7152*g+.0722*b;
      if((saturation>28&&Math.min(r,g,b)<238)||luminance<205){
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        maxRadius=Math.max(maxRadius,Math.hypot(x-(info.width-1)/2,y-(info.height-1)/2));
      }
    }
    return {width:(maxX-minX+1)/info.width,height:(maxY-minY+1)/info.height,maxRadius:maxRadius/info.width};
  }
  const regular=await bounds("public/icon-512.png");
  assert.ok(regular.width>=.99,`regular icon width occupancy ${regular.width}`);
  assert.ok(regular.height>=.99,`regular icon height occupancy ${regular.height}`);
  const maskable=await bounds("public/icon-maskable-512.png");
  assert.ok(maskable.width>=.56,`maskable icon width occupancy ${maskable.width}`);
  assert.ok(maskable.height>=.56,`maskable icon height occupancy ${maskable.height}`);
  assert.ok(maskable.maxRadius<=.4,`maskable artwork radius ${maskable.maxRadius}`);
});

test("umbrella identity, exact default title and install icons are wired",()=>{
  const mark=source("components/TodijoUmbrellaMark.tsx"),layout=source("app/layout.tsx"),manifest=source("app/manifest.ts");
  assert.match(mark,/>To<\/text>/);assert.match(mark,/>Di<\/text>/);assert.match(mark,/>Jo<\/text>/);
  assert.match(mark,/umbrellaPanelLeft/);assert.match(mark,/umbrellaPanelCenter/);assert.match(mark,/umbrellaPanelRight/);assert.match(mark,/umbrellaShaft/);
  assert.match(layout,/default: "Todijo Marketplace"/);
  for(const path of ["public/favicon.png","public/apple-icon.png","public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png"])assert.equal(existsSync(path),true,path);
  assert.equal(existsSync("public/favicon.ico"),false);
  assert.equal(existsSync("app/apple-icon.png"),false);
  assert.equal(existsSync("app/icon.svg"),false);
  for(const icon of ["icon-192.png","icon-512.png","icon-maskable-512.png"])assert.match(manifest,new RegExp(icon.replace(".","\\.")));
  assert.doesNotMatch(manifest,/apple-icon|favicon|icon\.svg/);
  assert.match(layout,/apple-icon\.png\?v=11/);
  assert.match(layout,/favicon\.png\?v=1/);
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
