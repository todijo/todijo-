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
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/useBuyerMarket\(\)/);assert.match(source("lib/suppliers/buyer-pricing.ts"),new RegExp(SHOPPING_COUNTRY_STORAGE_KEY));assert.doesNotMatch(ui,/api\/account\/addresses/);assert.match(ui,/!country\|\|!variantId/);
 assert.doesNotMatch(ui,/setCountry\(locale|sellerCountry|originCountry|preferredCurrencyForCountry/);assert.match(source("lib/privacy-consent.ts"),/todijo-shopping-country-v1/);
});

test("product detail consumes the global localized market selector and has no address-management CTA",()=>{
 const ui=source("components/DropshippingProductPricing.tsx"),selector=source("components/ShoppingCountrySwitcher.tsx"),panel=source("components/ProductPurchasePanel.tsx"),checkout=source("app/checkout/page.tsx");
 assert.doesNotMatch(ui,/next\/link|href=.*account\/addresses|addShippingAddress|changeAddress|deliveryTo|LocalizedCountrySelect/);assert.match(ui,/useBuyerMarket\(\)/);assert.match(selector,/Intl\.DisplayNames/);assert.match(selector,/role="listbox"/);
 assert.doesNotMatch(panel,/address|destinationCountry/);assert.match(panel,/disabled=\{!available\|\|!pricingReady\}/);assert.match(checkout,/api\/account\/addresses/);assert.match(checkout,/shipping\("destination"\)/);
});

test("shopping-country values are normalized, restricted to ISO destinations and persisted safely",()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
 assert.equal(normalizeShoppingCountry(" fr "),"FR");assert.equal(normalizeShoppingCountry("XX"),null);assert.equal(normalizeShoppingCountry("France"),null);
 assert.equal(persistShoppingCountry(storage," de "),"DE");assert.equal(readShoppingCountry(storage),"DE");assert.equal(values.get(SHOPPING_COUNTRY_STORAGE_KEY),"DE");
});

test("public estimate route validates destination, accepts no client financial override, and guards admin preview",()=>{
 const route=source("app/api/products/[id]/dropshipping-pricing/route.ts");assert.match(route,/normalizeShoppingCountry\(body\.destinationCountry\)/);assert.match(route,/INVALID_DESTINATION/);assert.doesNotMatch(route,/defaultBuyerAddress|body\.supplierCost|body\.freight|body\.fxRate|body\.targetMargin/);assert.match(route,/buyerCurrency:body\.buyerCurrency/);
 assert.match(route,/previewRequested=new URL\(request\.url\)\.searchParams\.get\("adminPreview"\)==="1"/);assert.match(route,/if\(previewRequested\)await requireAdmin\(prisma,await readSession\(\)\)/);assert.match(route,/allowUnpublished:previewRequested/);
 assert.match(route,/productVariant\.findFirst/);assert.match(route,/active:true,stock:\{gt:0\},supplierVariantId:\{not:null\}/);assert.match(route,/orderBy:\[\{createdAt:"asc"\},\{id:"asc"\}\]/);
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/JSON\.stringify\(\{variantId:input\.variantId,quantity:input\.quantity,destinationCountry:input\.destinationCountry,buyerCurrency:input\.buyerCurrency\}\)/);assert.doesNotMatch(ui,/supplierCost|freightTotal|includedCost|targetMargin|fxRate/);
});

test("request identity changes for country, exact variant and quantity",()=>{
 const base={productId:"p",variantId:"v1",quantity:1,destinationCountry:"FR"};assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,destinationCountry:"DE"}));assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,variantId:"v2"}));assert.notEqual(dropshippingPricingRequestKey(base),dropshippingPricingRequestKey({...base,quantity:2}));
});

test("late requests are aborted and stale pricing cannot become active for a new line selection",()=>{
 const ui=source("components/DropshippingProductPricing.tsx"),panel=source("components/ProductPurchasePanel.tsx");assert.match(ui,/AbortController/);assert.match(ui,/controller\.abort\(\)/);assert.match(ui,/requestKey\.current===key/);assert.match(panel,/verifiedPricing&&verifiedPricing\.variantId===selectedVariant\?\.id&&verifiedPricing\.quantity===quantity/);
});

test("only exact successful authoritative quotes are cached and variant prefetch is sequential",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/authoritativeQuoteCache=new Map/);assert.match(ui,/validQuote\(data,input\)/);assert.match(ui,/authoritativeQuoteCache\.set\(`\$\{dropshippingPricingRequestKey\(input\)\}:\$\{input\.buyerCurrency\}`/);
 assert.match(ui,/productId,variantId:id,quantity,destinationCountry:country,buyerCurrency:market\.currency/);assert.match(ui,/for\(const id of prefetchIds\)/);assert.match(ui,/await requestQuote/);assert.match(ui,/PREFETCH_DELAY_MS=900/);assert.doesNotMatch(ui,/Promise\.all\(prefetchIds/);
});

test("buyer UI performs no money, freight, margin or FX calculation",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.doesNotMatch(ui,/supplierCost|freightTotal|includedCost|targetMargin|fxRate|OPEN_EXCHANGE_RATES|CJ_API_KEY/);assert.match(ui,/buyerUnitPrice/);assert.match(ui,/freeShipping/);assert.match(ui,/deliveryMinDays/);
});

test("free shipping, delivery and EUR formatting derive only from buyer-safe response without exposing the unavailable-price sentence",()=>{
 const ui=source("components/DropshippingProductPricing.tsx");assert.match(ui,/state\.data\.freeShipping/);assert.match(ui,/shipping\("estimate"/);assert.doesNotMatch(ui,/pricingUnavailable/);assert.match(ui,/Intl\.NumberFormat/);assert.doesNotMatch(ui,/freeShipping:\s*true/);
});

test("deferred-price buyer surfaces never render the temporary-unavailable translation",()=>{
 for(const path of ["app/HomeClient.tsx","components/MarketplaceProductCard.tsx","components/DropshippingProductPricing.tsx","components/ProductPurchasePanel.tsx","app/product/[id]/ProductDetailPrice.tsx","app/product/[id]/page.tsx","app/cart/page.tsx"])assert.doesNotMatch(source(path),/pricingUnavailable/);
});

test("all 14 locales provide product pricing states and the scoped mobile path is present",()=>{
 assert.equal(Object.keys(buyerPricingMessages).length,14);for(const messages of Object.values(buyerPricingMessages))assert.deepEqual(Object.keys(messages).sort(),Object.keys(buyerPricingMessages.en).sort());
 const css=source("app/globals.css");assert.match(css,/\.dropshippingBuyerPricing/);assert.match(css,/@media\(max-width:760px\).*\.dropshippingBuyerPricing/);
});

test("manual override and errors cannot enable embedded shipping client-side",()=>{
 const service=source("lib/suppliers/commerce-pricing.ts"),ui=source("components/DropshippingProductPricing.tsx");assert.match(service,/shippingIncluded=mode==="AUTOMATIC"/);assert.match(ui,/data\.eligible===true/);assert.match(ui,/!validQuote\(data,input\)/);assert.match(ui,/setState\(\{status:"error",data:null\}\)/);
});
