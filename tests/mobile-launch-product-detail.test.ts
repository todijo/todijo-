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

test("launch branding relies on the native PWA splash without a delayed JavaScript overlay",()=>{
  const layout=source("app/layout.tsx"),manifest=source("app/manifest.ts"),worker=source("public/sw.js");
  assert.doesNotMatch(layout,/TodijoLaunchSplash/);
  assert.match(manifest,/background_color: "#fffaf0"/);
  assert.match(manifest,/icon-maskable-512\.png\?v=7/);
  assert.match(worker,/CACHE_VERSION = "mobile-brand-v7"/);
});

test("PWA startup icons use the centered square derivative of the supplied Todijo artwork",()=>{
  const icons=[
    ["public/icon-192.png",192,"e4262bfd4873faf554189bbc4d8060c11340af4ca2687899a0224c41f7c54f84"],
    ["public/icon-512.png",512,"ade82a61f0105df45a8aefa48fe450e6380b9a32385db986aeae569a61b116e4"],
    ["public/icon-maskable-512.png",512,"8a20fc41ff08cab2b8eadbcfd05e97a08aa9da68caa43c2a06bae0c37f1af27a"],
    ["public/apple-icon.png",180,"7a7641d077e51de94dbb3a500e3270ab21d6312e258e81577105d0099575a6c2"],
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
  assert.ok(regular.width>=.89,`regular icon width occupancy ${regular.width}`);
  assert.ok(regular.height>=.52,`regular icon height occupancy ${regular.height}`);
  const maskable=await bounds("public/icon-maskable-512.png");
  assert.ok(maskable.width>=.76,`maskable icon width occupancy ${maskable.width}`);
  assert.ok(maskable.maxRadius<=.4,`maskable artwork radius ${maskable.maxRadius}`);
});

test("umbrella identity, exact default title and install icons are wired",()=>{
  const mark=source("components/TodijoUmbrellaMark.tsx"),layout=source("app/layout.tsx"),manifest=source("app/manifest.ts");
  assert.match(mark,/>To<\/text>/);assert.match(mark,/>Di<\/text>/);assert.match(mark,/>Jo<\/text>/);
  assert.match(mark,/umbrellaPanelLeft/);assert.match(mark,/umbrellaPanelCenter/);assert.match(mark,/umbrellaPanelRight/);assert.match(mark,/umbrellaShaft/);
  assert.match(layout,/default: "Todijo Marketplace"/);
  for(const path of ["public/favicon.ico","public/apple-icon.png","public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png"])assert.equal(existsSync(path),true,path);
  assert.equal(existsSync("app/apple-icon.png"),false);
  assert.equal(existsSync("app/icon.svg"),false);
  for(const icon of ["icon-192.png","icon-512.png","icon-maskable-512.png"])assert.match(manifest,new RegExp(icon.replace(".","\\.")));
  assert.doesNotMatch(manifest,/apple-icon|favicon|icon\.svg/);
  assert.match(layout,/apple-icon\.png\?v=7/);
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
