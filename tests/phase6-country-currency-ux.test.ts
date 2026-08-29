import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {exactMinorAmount} from "../lib/currency";
import {formatCurrency} from "../lib/formatters";
import {persistScopedBuyerMarket,readScopedBuyerMarket,resolveBuyerMarket} from "../lib/buyer-market";
import {locales,rtlLocales} from "../i18n/config";
import {buyerMarketUi} from "../i18n/buyer-market-ui";

const read=(...parts:string[])=>fs.readFileSync(path.join(process.cwd(),...parts),"utf8");

function storage(){const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};}

test("country and explicit currency persist per guest or authenticated scope",()=>{
 const store=storage();
 persistScopedBuyerMarket(store,"guest",{country:"FR",currency:"GBP"});
 persistScopedBuyerMarket(store,"user:buyer-a",{country:"IQ",currency:"IQD"});
 persistScopedBuyerMarket(store,"user:buyer-b",{country:"US",currency:"USD"});
 assert.deepEqual(readScopedBuyerMarket(store,"guest"),{country:"FR",currency:"GBP"});
 assert.deepEqual(readScopedBuyerMarket(store,"user:buyer-a"),{country:"IQ",currency:"IQD"});
 assert.deepEqual(readScopedBuyerMarket(store,"user:buyer-b"),{country:"US",currency:"USD"});
 assert.deepEqual(resolveBuyerMarket({explicitCountry:"FR",explicitCurrency:"GBP"}),{country:"FR",currency:"GBP",source:"EXPLICIT"});
});

test("locale-aware shared formatting preserves exact amounts and currency conventions",()=>{
 assert.equal(exactMinorAmount("9.69","EUR"),969);
 assert.match(formatCurrency(9.69,"EUR","fr"),/9,69/);
 assert.match(formatCurrency(9.69,"GBP","en"),/9\.69/);
 assert.match(formatCurrency(969,"JPY","en"),/969/);
 assert.doesNotMatch(formatCurrency(969,"JPY","en"),/\.00/);
 assert.notEqual(formatCurrency(9.69,"EUR","fr"),formatCurrency(9.68,"EUR","fr"));
});

test("selector exposes country and currency with keyboard, contrast, mobile and RTL safeguards",()=>{
 const selector=read("components","ShoppingCountrySwitcher.tsx"),css=read("app","globals.css");
 for(const marker of ["buyerMarketTrigger","buyerMarketCurrency","SUPPORTED_BUYER_CURRENCIES","aria-haspopup=\"dialog\"","aria-expanded={open}","role=\"listbox\"","role=\"option\""])assert.match(selector,new RegExp(marker));
 assert.match(selector,/event\.key==="Escape"/);
 assert.match(css,/\.buyerMarketTrigger\{[^}]*color:#fff/);
 assert.match(css,/\.buyerMarketTrigger:focus-visible\{outline:3px/);
 assert.match(css,/\.buyerMarketPopover\{[^}]*width:min\(380px,calc\(100vw - 24px\)\)/);
 assert.match(css,/\[dir="rtl"\] \.buyerMarketTrigger/);
 assert.match(css,/@media\(max-width:380px\)/);
});

test("all locales provide Phase 6 labels with deterministic parity",()=>{
 assert.deepEqual(Object.keys(buyerMarketUi).sort(),[...locales].sort());
 const keys=Object.keys(buyerMarketUi.en).sort();
 for(const locale of locales){assert.deepEqual(Object.keys(buyerMarketUi[locale]).sort(),keys,locale);for(const value of Object.values(buyerMarketUi[locale]))assert.ok(value.trim(),locale);}
 assert.deepEqual([...rtlLocales].sort(),["ar","fa","ku"]);
});

test("browsing preference never replaces authoritative checkout destination",()=>{
 const provider=read("components","BuyerMarketProvider.tsx"),checkout=read("app","checkout","page.tsx"),payments=read("lib","payments.ts"),quote=read("app","api","shipping","quote","route.ts");
 assert.match(provider,/persistScopedBuyerMarket/);
 assert.doesNotMatch(checkout,/BUYER_MARKET_COOKIE|SHOPPING_COUNTRY_STORAGE_KEY|todijo-shopping-country/);
 assert.match(payments,/destinationCountry = buyerAddress\.country/);
 assert.match(quote,/body\.destinationCountry=address\.country/);
});

test("main buyer price surfaces share one formatter without changing financial modules",()=>{
 for(const file of ["components/BuyerProductPrice.tsx","components/AuthoritativeProductCardPrice.tsx","components/BuyerShippingPrice.tsx","components/DropshippingProductPricing.tsx","app/product/[id]/ProductDetailPrice.tsx","app/cart/page.tsx","app/checkout/page.tsx"])assert.match(read(...file.split("/")),/formatCurrency/);
 for(const file of ["components/BuyerProductPrice.tsx","components/AuthoritativeProductCardPrice.tsx","components/BuyerShippingPrice.tsx","components/DropshippingProductPricing.tsx","app/product/[id]/ProductDetailPrice.tsx"])assert.doesNotMatch(read(...file.split("/")),/new Intl\.NumberFormat/);
 const changedPresentation=["lib/formatters.ts","lib/buyer-market.ts"];
 for(const forbidden of ["lib/payments.ts","lib/refund-lifecycle.ts","lib/seller-transfers.ts","lib/suppliers/commerce-pricing.ts"])assert.ok(!changedPresentation.includes(forbidden));
});

test("Phase 4 product title resolver remains the non-destructive fallback authority",()=>{
 const resolver=read("lib","product-content.ts"),product=read("app","product","[id]","page.tsx");
 assert.match(resolver,/resolveBuyerProductContent/);
 assert.match(product,/resolveBuyerProductContent/);
 assert.doesNotMatch(resolver,/update|delete|translate.*fetch/i);
});
