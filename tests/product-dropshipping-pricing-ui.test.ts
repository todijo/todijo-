import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buyerPricingMessages} from "../i18n/buyer-pricing";
import {dropshippingPricingRequestKey,normalizeShoppingCountry,persistShoppingCountry,readShoppingCountry,SHOPPING_COUNTRY_STORAGE_KEY} from "../lib/suppliers/buyer-pricing";

const source=(path:string)=>readFileSync(path,"utf8");
test("eligible product detail enables the authoritative pricing UI while normal products retain the old path",()=>{
 const page=source("app/product/[id]/page.tsx"),panel=source("components/ProductPurchasePanel.tsx");
 assert.match(page,/resolveDropshippingEligibility/);assert.match(page,/dropshippingEligible=\{dropshippingEligibility\.eligible\}/);assert.match(panel,/enabled=\{dropshippingEligible\}/);
 assert.match(panel,/disabled=\{!available\|\|!pricingReady\}/);assert.doesNotMatch(panel,/ADDRESS_REQUIRED|account\/addresses/);
});

test("shopping-country preference drives the estimate and is never inferred from locale, seller, origin, or currency",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/readShoppingCountry\(window\.localStorage\)/);assert.match(source("lib/suppliers/buyer-pricing.ts"),new RegExp(SHOPPING_COUNTRY_STORAGE_KEY));assert.doesNotMatch(ui,/api\/account\/addresses/);assert.match(ui,/!country\|\|!variantId/);
 assert.doesNotMatch(ui,/setCountry\(locale|sellerCountry|originCountry|preferredCurrencyForCountry/);assert.match(source("lib/privacy-consent.ts"),/todijo-shopping-country-v1/);
});

test("product detail renders a localized estimate-country selector and no address-management CTA",()=>{
 const ui=source("components/DropshippingProductPricing.tsx"),panel=source("components/ProductPurchasePanel.tsx"),checkout=source("app/checkout/page.tsx");
 assert.doesNotMatch(ui,/next\/link|href=.*account\/addresses|addShippingAddress|changeAddress|deliveryTo/);assert.match(ui,/LocalizedCountrySelect/);assert.match(ui,/destinationRequired/);
 assert.doesNotMatch(panel,/address|destinationCountry/);assert.match(panel,/disabled=\{!available\|\|!pricingReady\}/);assert.match(checkout,/api\/account\/addresses/);assert.match(checkout,/shipping\("destination"\)/);
});

test("shopping-country values are normalized, restricted to ISO destinations and persisted safely",()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
 assert.equal(normalizeShoppingCountry(" fr "),"FR");assert.equal(normalizeShoppingCountry("XX"),null);assert.equal(normalizeShoppingCountry("France"),null);
 assert.equal(persistShoppingCountry(storage," de "),"DE");assert.equal(readShoppingCountry(storage),"DE");assert.equal(values.get(SHOPPING_COUNTRY_STORAGE_KEY),"DE");
});

test("public estimate route validates destination and accepts no client financial override",()=>{
 const route=source("app/api/products/[id]/dropshipping-pricing/route.ts");assert.match(route,/normalizeShoppingCountry\(body\.destinationCountry\)/);assert.match(route,/INVALID_DESTINATION/);assert.doesNotMatch(route,/readSession|defaultBuyerAddress|body\.buyerCurrency/);assert.match(route,/buyerCurrency:undefined/);
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/JSON\.stringify\(\{variantId,quantity,destinationCountry:country\}\)/);assert.doesNotMatch(ui,/supplierCost|freightTotal|includedCost|targetMargin|fxRate|buyerCurrency:/);
});

test("request identity changes for country, exact variant and quantity",()=>{
 const base={productId:"p",variantId:"v1",quantity:1,destinationCountry:"FR"};assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,destinationCountry:"DE"}));assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,variantId:"v2"}));assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,quantity:2}));
});

test("late requests are aborted and stale pricing cannot become active for a new line selection",()=>{
 const ui=source("components/DropshippingProductPricing.tsx"),panel=source("components/ProductPurchasePanel.tsx");assert.match(ui,/AbortController/);assert.match(ui,/controller\.abort\(\)/);assert.match(ui,/requestKey\.current===key/);assert.match(panel,/verifiedPricing&&verifiedPricing\.variantId===selectedVariant\?\.id&&verifiedPricing\.quantity===quantity/);
});

test("buyer UI performs no money, freight, margin or FX calculation",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.doesNotMatch(ui,/supplierCost|freightTotal|includedCost|targetMargin|fxRate|OPEN_EXCHANGE_RATES|CJ_API_KEY/);assert.match(ui,/buyerUnitPrice/);assert.match(ui,/freeShipping/);assert.match(ui,/deliveryMinDays/);
});

test("free shipping, delivery, localized error and EUR formatting derive only from buyer-safe response",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/state\.data\.freeShipping/);assert.match(ui,/shipping\("estimate"/);assert.match(ui,/pricingUnavailable/);assert.match(ui,/Intl\.NumberFormat/);assert.doesNotMatch(ui,/freeShipping:\s*true/);
});

test("all 14 locales provide product pricing states and the scoped mobile path is present",()=>{
 assert.equal(Object.keys(buyerPricingMessages).length,14);for(const messages of Object.values(buyerPricingMessages))assert.deepEqual(Object.keys(messages).sort(),Object.keys(buyerPricingMessages.en).sort());
 const css=source("app/globals.css");assert.match(css,/\.dropshippingBuyerPricing/);assert.match(css,/@media\(max-width:760px\).*\.dropshippingBuyerPricing/);
});

test("manual override and errors cannot enable embedded shipping client-side",()=>{
 const service=source("lib/suppliers/commerce-pricing.ts"),ui=source("components/DropshippingProductPricing.tsx");assert.match(service,/shippingIncluded=mode==="AUTOMATIC"/);assert.match(ui,/data\.eligible!==true/);assert.match(ui,/setState\(\{status:"error",data:null\}\)/);
});
