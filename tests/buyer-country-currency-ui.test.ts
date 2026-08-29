import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DEFAULT_BUYER_CURRENCY,preferredCurrencyForCountry} from "../lib/currency";

test("Iraq uses IQD and unknown global markets fail to the USD presentment fallback",()=>{
  assert.equal(preferredCurrencyForCountry("IQ"),"IQD");
  assert.equal(DEFAULT_BUYER_CURRENCY,"USD");
  assert.equal(preferredCurrencyForCountry("ZZ"),"USD");
});

test("marketplace exposes a persisted country selector and safe proxy country detection",()=>{
  const header=readFileSync("components/MarketplaceHeader.tsx","utf8");
  const selector=readFileSync("components/ShoppingCountrySwitcher.tsx","utf8");
  const provider=readFileSync("components/BuyerMarketProvider.tsx","utf8");
  const geo=readFileSync("app/api/geo/country/route.ts","utf8");
  assert.match(header,/ShoppingCountrySwitcher/);
  assert.match(selector,/useBuyerMarket/);
  assert.match(selector,/selectCountry/);
  assert.match(provider,/readScopedBuyerMarket/);
  assert.match(provider,/persistScopedBuyerMarket/);
  assert.doesNotMatch(provider,/localStorage\.removeItem\(BUYER_CURRENCY_STORAGE_KEY\)/);
  assert.match(provider,/explicitCurrency:saved\.currency/);
  assert.match(provider,/user:\$\{session\.userId\}/);
  assert.match(provider,/\/api\/geo\/country/);
  assert.match(geo,/cf-ipcountry/);
  assert.match(geo,/x-vercel-ip-country/);
  assert.match(geo,/normalizeShoppingCountry/);
  assert.doesNotMatch(geo,/fetch\(/);
});
