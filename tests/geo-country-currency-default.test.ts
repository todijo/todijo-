import test from "node:test";
import assert from "node:assert/strict";
import {BUYER_CURRENCY_COOKIE,BUYER_MARKET_COOKIE,BUYER_MARKET_SCOPE_COOKIE,marketCookie,readBuyerMarketCookies,resolveBuyerMarket} from "../lib/buyer-market";
import {detectRequestCountry} from "../lib/geo-country";

for(const [country,currency] of [["FR","EUR"],["DE","EUR"],["US","USD"],["GB","GBP"]]){
 test(`fresh ${country} detection initializes ${currency}`,()=>{
  assert.deepEqual(resolveBuyerMarket({detectedCountry:country}),{country,currency,source:"DETECTED"});
 });
}

test("missing, invalid and ambiguous detection falls back to France/EUR",()=>{
 for(const detectedCountry of [undefined,null,"","XX","T1","US,FR",["US","FR"],{},"United States"]){
  assert.deepEqual(resolveBuyerMarket({detectedCountry}),{country:"FR",currency:"EUR",source:"FALLBACK"});
 }
});

test("each preference field follows explicit, account, cookie, geo, country default priority",()=>{
 const lower={accountCountry:"DE",accountCurrency:"GBP",sessionCountry:"GB",sessionCurrency:"JPY",detectedCountry:"US"};
 assert.deepEqual(resolveBuyerMarket({...lower,explicitCountry:"FR",explicitCurrency:"CHF"}),{country:"FR",currency:"CHF",source:"EXPLICIT"});
 assert.deepEqual(resolveBuyerMarket(lower),{country:"DE",currency:"GBP",source:"EXPLICIT"});
 assert.deepEqual(resolveBuyerMarket({...lower,accountCountry:"XX",accountCurrency:"BTC"}),{country:"GB",currency:"JPY",source:"EXPLICIT"});
 assert.deepEqual(resolveBuyerMarket({sessionCountry:"XX",sessionCurrency:"BTC",detectedCountry:"US"}),{country:"US",currency:"USD",source:"DETECTED"});
 assert.deepEqual(resolveBuyerMarket({explicitCurrency:"GBP",detectedCountry:"US"}),{country:"US",currency:"GBP",source:"EXPLICIT"});
 assert.equal(resolveBuyerMarket({accountCountry:"GB",detectedCountry:"US"}).currency,"GBP");
 assert.equal(resolveBuyerMarket({explicitCountry:"FR",sessionCurrency:"USD",detectedCountry:"GB"}).currency,"USD");
});

test("valid proxy headers agree; malformed or conflicting headers are not trusted detection",()=>{
 assert.equal(detectRequestCountry(new Headers()),null);
 for(const name of ["cf-ipcountry","x-vercel-ip-country","x-country-code","x-forwarded-country"]){
  assert.equal(detectRequestCountry(new Headers({[name]:"us"})),"US");
 }
 assert.equal(detectRequestCountry(new Headers({"cf-ipcountry":"DE","x-vercel-ip-country":"DE"})),"DE");
 const invalidHeaders:Record<string,string>[]=[{"cf-ipcountry":"XX"},{"cf-ipcountry":"US, FR"},{"cf-ipcountry":"FR","x-vercel-ip-country":"US"},{"cf-ipcountry":"US","x-country-code":"not-a-country"}];
 for(const headers of invalidHeaders){
  const country=detectRequestCountry(new Headers(headers));
  assert.equal(country,null);
  assert.equal(resolveBuyerMarket({detectedCountry:country}).country,"FR");
 }
});

test("cookies restore independently, reject malformed values, and isolate account scopes",()=>{
 const cookies=`${BUYER_MARKET_COOKIE}=GB; ${BUYER_CURRENCY_COOKIE}=CHF; ${BUYER_MARKET_SCOPE_COOKIE}=user%3Abuyer-a`;
 assert.deepEqual(readBuyerMarketCookies(cookies,"user:buyer-a"),{country:"GB",currency:"CHF"});
 assert.deepEqual(readBuyerMarketCookies(cookies,"user:buyer-b"),{country:null,currency:null});
 assert.deepEqual(readBuyerMarketCookies(cookies,"guest"),{country:null,currency:null});
 assert.deepEqual(readBuyerMarketCookies(`${BUYER_MARKET_COOKIE}=us; ${BUYER_CURRENCY_COOKIE}=gbp`,"guest"),{country:"US",currency:"GBP"});
 assert.deepEqual(readBuyerMarketCookies(`${BUYER_MARKET_COOKIE}=%broken; ${BUYER_CURRENCY_COOKIE}=BTC`,"guest"),{country:null,currency:null});
 assert.match(marketCookie(BUYER_MARKET_SCOPE_COOKIE,"user:buyer-a"),/user%3Abuyer-a/);
});
