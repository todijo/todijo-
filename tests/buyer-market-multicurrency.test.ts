import test from "node:test";
import assert from "node:assert/strict";
import {Prisma} from "@prisma/client";
import {resolveBuyerMarket} from "../lib/buyer-market";
import {currencyMinorUnits,roundCurrencyUp} from "../lib/currency";
import {preferredCurrencyForCountry} from "../lib/currency";
import {convertMarketplacePrice,memoizeFxResolver} from "../lib/marketplace-presentment";
import {readFileSync} from "node:fs";

test("buyer markets resolve independently from locale with safe USD fallback",()=>{
 assert.equal(resolveBuyerMarket({explicitCountry:"IQ"}).currency,"IQD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR"}).currency,"EUR");
 assert.equal(resolveBuyerMarket({explicitCountry:"GB"}).currency,"GBP");
 assert.equal(resolveBuyerMarket({explicitCountry:"US"}).currency,"USD");
 assert.equal(resolveBuyerMarket({detectedCountry:"XX"}).currency,"USD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR",explicitCurrency:"USD"}).currency,"USD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR",explicitCurrency:"BTC"}).currency,"EUR");
});

test("native Stripe-supported country currencies are explicit and unknown markets fall back to USD",()=>{
 const expected={AD:"EUR",FR:"EUR",DE:"EUR",GB:"GBP",US:"USD",CA:"CAD",AU:"AUD",CH:"CHF",JP:"JPY",SE:"SEK",NO:"NOK",DK:"DKK",PL:"PLN",CZ:"CZK",HU:"HUF",RO:"RON",TR:"TRY",AE:"AED",SA:"SAR",QA:"QAR",SG:"SGD",HK:"HKD",NZ:"NZD",KR:"KRW",IN:"INR",MX:"MXN",BR:"BRL",ZA:"ZAR",IQ:"IQD",AF:"AFN",AL:"ALL",DZ:"DZD",AR:"ARS",BD:"BDT",BG:"BGN",BH:"BHD",CN:"CNY",EG:"EGP",ID:"IDR",IL:"ILS",JO:"JOD",KW:"KWD",MA:"MAD",MY:"MYR",NG:"NGN",OM:"OMR",PH:"PHP",PK:"PKR",TH:"THB",TW:"TWD",UA:"UAH",VN:"VND"};
 for(const [country,currency] of Object.entries(expected))assert.equal(preferredCurrencyForCountry(country),currency,country);
 assert.equal(preferredCurrencyForCountry("ZZ"),"USD");
});

test("ordinary seller price uses verified FX and correct minor-unit rounding",async()=>{
 const result=await convertMarketplacePrice("10.01","EUR","USD",async()=>({provider:"OPEN_EXCHANGE_RATES",baseCurrency:"EUR",quoteCurrency:"USD",rate:"1.1",fetchedAt:"2026-08-23T00:00:00.000Z",effectiveAt:"2026-08-23T00:00:00.000Z"}));
 assert.equal(result.buyerAmount,"11.02");
 assert.equal(roundCurrencyUp(new Prisma.Decimal("100.01"),"JPY").toString(),"101");
 assert.equal(currencyMinorUnits("JPY"),0);assert.equal(currencyMinorUnits("USD"),2);assert.equal(currencyMinorUnits("IQD"),2);
});

test("one verified FX lookup is reused for multiple ordinary seller prices",async()=>{
 let calls=0;const fx=memoizeFxResolver(async(base,quote)=>{calls++;return{provider:"OPEN_EXCHANGE_RATES",baseCurrency:String(base) as "EUR",quoteCurrency:String(quote) as "USD",rate:"1.1",fetchedAt:"2026-08-23T00:00:00.000Z",effectiveAt:"2026-08-23T00:00:00.000Z"}});
 const values=await Promise.all(["10","20","30"].map(amount=>convertMarketplacePrice(amount,"EUR","USD",fx)));
 assert.deepEqual(values.map(value=>value.buyerAmount),["11","22","33"]);assert.equal(calls,1);
});

test("market selector is controlled and mobile is paired with language",()=>{
 const selector=readFileSync("components/ShoppingCountrySwitcher.tsx","utf8"),mobile=readFileSync("components/BuyerMobileNavigation.tsx","utf8"),layout=readFileSync("app/layout.tsx","utf8");
 assert.match(selector,/buyerMarketPopover/);assert.match(selector,/type="search"/);assert.match(selector,/role="listbox"/);assert.doesNotMatch(selector,/window\.location\.reload/);
 assert.match(mobile,/buyerMobileMarketControls/);assert.match(mobile,/ShoppingCountrySwitcher/);assert.match(layout,/BuyerMarketProvider/);
});

test("ordinary cards batch only the active currency and CJ cards use the shared one-QPS queue with retry",()=>{
 const ordinary=readFileSync("components/BuyerProductPrice.tsx","utf8"),cj=readFileSync("components/AuthoritativeProductCardPrice.tsx","utf8"),route=readFileSync("app/api/products/buyer-pricing/route.ts","utf8");
 assert.match(ordinary,/timer=setTimeout/);assert.match(ordinary,/groups\.set\(item\.currency/);assert.doesNotMatch(ordinary,/SHIPPING_COUNTRY_CODES|for\(const country/);assert.match(ordinary,/priceCache/);assert.match(ordinary,/priceRetry/);
 assert.match(route,/memoizeFxResolver\(\)/);assert.match(cj,/scheduleCj/);assert.match(cj,/nextCjStart=Date\.now\(\)\+1000/);assert.match(cj,/priceRetry/);
});

test("same-currency country changes do not reprice ordinary shipping or cart lines",()=>{
 const shipping=readFileSync("components/BuyerShippingPrice.tsx","utf8"),cart=readFileSync("components/CartProvider.tsx","utf8");
 assert.doesNotMatch(shipping,/market\.country/);assert.match(shipping,/\[kind,market\.currency,market\.ready,productId\]/);
 assert.match(cart,/ordinaryCurrencyRef\.current!==market\.currency/);assert.match(cart,/item\.requiresAuthoritativePrice\|\|refreshNormal/);
 assert.match(cart,/destinationCountry:market\.country/);
});

test("checkout and shipping use one authoritative presentment currency",()=>{
 const payments=readFileSync("lib/payments.ts","utf8"),shipping=readFileSync("app/api/shipping/quote/route.ts","utf8");
 assert.match(payments,/convertMarketplacePrice\(line\.sourceUnitPrice/);assert.match(payments,/explicitPreference:pricingDependencies\.buyerCurrency/);assert.doesNotMatch(payments,/normalCurrencies\.size>1/);
 assert.match(shipping,/convertMarketplacePrice\(unit/);assert.match(shipping,/explicitPreference:body\.buyerCurrency/);
});
