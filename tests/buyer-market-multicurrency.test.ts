import test from "node:test";
import assert from "node:assert/strict";
import {Prisma} from "@prisma/client";
import {resolveBuyerMarket} from "../lib/buyer-market";
import {currencyMinorUnits,roundCurrencyUp} from "../lib/currency";
import {convertMarketplacePrice} from "../lib/marketplace-presentment";
import {readFileSync} from "node:fs";

test("buyer markets resolve independently from locale with safe USD fallback",()=>{
 assert.equal(resolveBuyerMarket({explicitCountry:"IQ"}).currency,"USD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR"}).currency,"EUR");
 assert.equal(resolveBuyerMarket({explicitCountry:"GB"}).currency,"GBP");
 assert.equal(resolveBuyerMarket({explicitCountry:"US"}).currency,"USD");
 assert.equal(resolveBuyerMarket({detectedCountry:"XX"}).currency,"USD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR",explicitCurrency:"USD"}).currency,"USD");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR",explicitCurrency:"BTC"}).currency,"EUR");
});

test("ordinary seller price uses verified FX and correct minor-unit rounding",async()=>{
 const result=await convertMarketplacePrice("10.01","EUR","USD",async()=>({provider:"OPEN_EXCHANGE_RATES",baseCurrency:"EUR",quoteCurrency:"USD",rate:"1.1",fetchedAt:"2026-08-23T00:00:00.000Z",effectiveAt:"2026-08-23T00:00:00.000Z"}));
 assert.equal(result.buyerAmount,"11.02");
 assert.equal(roundCurrencyUp(new Prisma.Decimal("100.01"),"JPY").toString(),"101");
 assert.equal(currencyMinorUnits("JPY"),0);assert.equal(currencyMinorUnits("USD"),2);
});

test("market selector is controlled and mobile is paired with language",()=>{
 const selector=readFileSync("components/ShoppingCountrySwitcher.tsx","utf8"),mobile=readFileSync("components/BuyerMobileNavigation.tsx","utf8"),layout=readFileSync("app/layout.tsx","utf8");
 assert.match(selector,/buyerMarketPopover/);assert.match(selector,/type="search"/);assert.match(selector,/role="listbox"/);assert.doesNotMatch(selector,/window\.location\.reload/);
 assert.match(mobile,/buyerMobileMarketControls/);assert.match(mobile,/ShoppingCountrySwitcher/);assert.match(layout,/BuyerMarketProvider/);
});

test("checkout and shipping use one authoritative presentment currency",()=>{
 const payments=readFileSync("lib/payments.ts","utf8"),shipping=readFileSync("app/api/shipping/quote/route.ts","utf8");
 assert.match(payments,/convertMarketplacePrice\(line\.sourceUnitPrice/);assert.match(payments,/explicitPreference:pricingDependencies\.buyerCurrency/);assert.doesNotMatch(payments,/normalCurrencies\.size>1/);
 assert.match(shipping,/convertMarketplacePrice\(unit/);assert.match(shipping,/explicitPreference:body\.buyerCurrency/);
});
