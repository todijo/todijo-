import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source=(path:string)=>readFileSync(path,"utf8");
const locales=["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"];

test("mobile home is product-first while desktop merchandising remains rendered",()=>{
  const home=source("app/HomeClient.tsx"),css=source("app/globals.css");
  for(const marker of ["discoveryHero","discoveryPromoBanner","featuredStores","sellerGrowthCta","MobileAppPromotion"])assert.match(home,new RegExp(marker));
  assert.match(css,/@media\(max-width:860px\)[\s\S]*?\.buyerHomePage:not\(\.searchResultsPage\) \.discoveryHero,[\s\S]*?\.featuredStores,[\s\S]*?\.mobileAppPromotion\{display:none!important\}/);
  assert.match(css,/\.premiumHeroSlider\{position:relative/);
});

test("Boutiques is a localized category peer leading to the existing store route",()=>{
  const navigation=source("components/BuyerMobileNavigation.tsx");
  assert.match(navigation,/className="buyerMobileBoutiquesLink"/);
  assert.match(navigation,/className="buyerMobileStoresLink"/);
  const hamburger=navigation.match(/categoriesOpen \? <section[\s\S]*? : <><nav[\s\S]*?<\/nav>/)?.[0]??"";
  assert.match(hamburger,/buyerMobileStoresLink/);
  assert.match(hamburger,/localizedPath\(locale, "\/store"\)/);
  assert.match(hamburger,/footer\("stores"\)/);
  assert.match(navigation,/localizedPath\(locale, "\/store"\)/);
  assert.match(navigation,/footer\("stores"\)/);
  for(const locale of locales)assert.equal(typeof JSON.parse(source(`messages/home-footer/${locale}.json`)).stores,"string",locale);
  assert.equal(JSON.parse(source("messages/home-footer/fr.json")).stores,"Boutiques");
});

test("mobile footer is compact and collapsible without removing legal links",()=>{
  const footer=source("components/MarketplaceFooter.tsx"),css=source("app/globals.css");
  assert.match(footer,/marketplaceFooterMobileGroups/);
  assert.match(footer,/<details key=\{group\.title\}/);
  assert.match(footer,/<summary>/);
  for(const slug of ["terms","privacy","cookies","data-deletion","legal-notice","marketplace-rules"])assert.ok(footer.includes(`info("${slug}")`),slug);
  assert.match(css,/\.marketplaceFooterTrust,\.marketplaceFooterMain\{display:none!important\}/);
  assert.match(css,/padding-bottom:calc\(82px \+ env\(safe-area-inset-bottom\)\)/);
});

test("bottom navigation remains exactly five app-safe destinations",()=>{
  const navigation=source("components/BuyerMobileNavigation.tsx");
  const bottom=navigation.match(/<nav className="buyerMobileBottomNav"[\s\S]*?<\/nav>/)?.[0]??"";
  assert.equal((bottom.match(/<(?:a|Link|button)\b/g)??[]).length,5);
  assert.match(source("app/globals.css"),/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test("current PWA metadata references only versioned purple Todijo launcher assets",()=>{
  const manifest=source("app/manifest.ts"),worker=source("public/sw.js"),layout=source("app/layout.tsx");
  for(const icon of ["icon-192.png?v=3","icon-512.png?v=3","icon-maskable-512.png?v=3","apple-icon.png?v=3"])assert.ok(manifest.includes(icon),icon);
  for(const icon of ["public/icon-192.png","public/icon-512.png","public/icon-maskable-512.png","public/apple-icon.png"])assert.ok(existsSync(icon),icon);
  assert.doesNotMatch(layout,/TodijoLaunchSplash/);
  assert.doesNotMatch(manifest+worker,/#0f8f65|#087653|green-shopping-bag/i);
});
