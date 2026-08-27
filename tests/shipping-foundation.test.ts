import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { cartShippingQuote, parseShippingSettings, ShippingError, shippingQuote } from "../lib/shipping";
import { advancedShippingMessages } from "../i18n/shipping-advanced";
import { SHIPPING_COUNTRY_CODES } from "../lib/shipping-countries";
import {parsePostalRule,postalRulesAllow,serializePostalRule} from "../lib/postal-rules";
import {shippingHotfixMessages} from "../i18n/shipping-hotfix";

const store = { shippingEnabled: true, shippingMethodName: "Standard", shippingPrice: new Prisma.Decimal("6.25"), shippingFree: false, shippingMinDays: 2, shippingMaxDays: 5, shippingCountries: ["fr", "BE"], shippingCarrier: "La Poste", shippingProvider: "MANUAL", shippingExternalServiceId: null, currency: "EUR" };

test("shipping quote is destination-aware and server-authoritative", () => {
  const quote = shippingQuote(store, " fr ");
  assert.equal(quote.amount.toFixed(2), "6.25");
  assert.equal(quote.destinationCountry, "FR");
  assert.equal(quote.method, "Standard");
  assert.deepEqual(quote.allowedCountries, ["FR", "BE"]);
  assert.throws(() => shippingQuote(store, "US"), (error: unknown) => error instanceof ShippingError && error.message === "SHIPPING_DESTINATION_UNAVAILABLE");
});

test("free shipping is explicit and unconfigured sellers stay blocked", () => {
  assert.equal(shippingQuote({ ...store, shippingFree: true, shippingPrice: null }, "BE").amount.isZero(), true);
  assert.throws(() => shippingQuote({ ...store, shippingEnabled: false }, "FR"), /SHIPPING_NOT_CONFIGURED/);
});

test("seller shipping input rejects negative prices and invalid ranges", () => {
  const base = { shippingEnabled: true, shippingMethodName: "Standard", shippingPrice: "4.50", shippingFree: false, shippingMinDays: "2", shippingMaxDays: "5", shippingCountries: ["FR"], shippingCarrier: "" };
  assert.equal(parseShippingSettings(base).shippingPrice?.toFixed(2), "4.50");
  assert.throws(() => parseShippingSettings({ ...base, shippingPrice: "-1" }), ShippingError);
  assert.throws(() => parseShippingSettings({ ...base, shippingMaxDays: "1" }), ShippingError);
});

test("worldwide is explicit and postal prefixes are authoritative",()=>{
 assert.throws(()=>shippingQuote({...store,shippingCountries:[]},"US"),/SHIPPING_DESTINATION_UNAVAILABLE/);
 const global={...store,shippingCountries:[],shippingWorldwide:true,shippingPostalCodes:["59*"]};
 assert.equal(shippingQuote(global,"FR","59000").destinationCountry,"FR");
 assert.throws(()=>shippingQuote(global,"FR","75000"),/SHIPPING_POSTAL_UNAVAILABLE/);
});

test("product overrides all apply and cart charges one deterministic maximum",()=>{
 const inherited={...store,id:"a",shippingOverrideEnabled:false};
 const local={...store,id:"b",shippingOverrideEnabled:true,shippingPrice:new Prisma.Decimal("9.00"),shippingCountries:["FR"],shippingPostalCodes:["59*"]};
 const quote=cartShippingQuote(store,[{product:inherited,subtotal:new Prisma.Decimal(20)},{product:local,subtotal:new Prisma.Decimal(10)}],"FR","59000");
 assert.equal(quote.amount.toFixed(2),"9.00"); assert.equal(quote.policies.length,2);
 assert.throws(()=>cartShippingQuote(store,[{product:inherited,subtotal:new Prisma.Decimal(20)},{product:local,subtotal:new Prisma.Decimal(10)}],"FR","75000"),/SHIPPING_POSTAL_UNAVAILABLE/);
});

test("free threshold excludes shipping and is evaluated server-side",()=>{
 const threshold={...store,shippingFreeThreshold:new Prisma.Decimal("20")};
 assert.equal(shippingQuote(threshold,"FR","",new Prisma.Decimal("19.99")).amount.toFixed(2),"6.25");
 assert.equal(shippingQuote(threshold,"FR","",new Prisma.Decimal("20")).amount.toFixed(2),"0.00");
});

test("migration is additive and keeps existing sellers safely disabled", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260810210000_add_shipping_foundation/migration.sql"), "utf8")+readFileSync(join(process.cwd(), "prisma/migrations/20260810213000_add_advanced_shipping_rules/migration.sql"), "utf8");
  assert.match(sql, /shippingEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /shippingCountries" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
  assert.match(sql,/shippingOverrideEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql,/shippingWorldwide" BOOLEAN NOT NULL DEFAULT false/);
  assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE|ALTER COLUMN/i);
});

test("shipping translations have key and placeholder parity in all locales", () => {
  const directory = join(process.cwd(), "messages/shipping");
  const files = readdirSync(directory).filter((file)=>file.endsWith(".json")).sort();
  assert.equal(files.length, 14);
  const reference = JSON.parse(readFileSync(join(directory, "en.json"), "utf8"));
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match)=>match[1]).sort();
  for (const file of files) { const current = JSON.parse(readFileSync(join(directory,file),"utf8")); assert.deepEqual(Object.keys(current).sort(),Object.keys(reference).sort()); for (const key of Object.keys(reference)) assert.deepEqual(placeholders(current[key]),placeholders(reference[key]),`${file}:${key}`); }
});

test("advanced shipping UI is available for all locales",()=>{assert.equal(Object.keys(advancedShippingMessages).length,14);for(const messages of Object.values(advancedShippingMessages))assert.deepEqual(Object.keys(messages).sort(),Object.keys(advancedShippingMessages.en).sort());});

test("country picker source contains the complete ISO destination set",()=>{assert.equal(SHIPPING_COUNTRY_CODES.length,249);assert.equal(new Set(SHIPPING_COUNTRY_CODES).size,249);for(const code of ["US","CA","SE","NO","DK","FI","NL","DE","BE","FR","CH","AT","PL","IT","ES","PT","IE","GR","RO","CZ","CN","JP","KR","AU","NZ","ZW"])assert.ok(SHIPPING_COUNTRY_CODES.includes(code),code);});

test("French country display names and full-list search are localized",()=>{const names=new Intl.DisplayNames(["fr"],{type:"region"});assert.equal(names.of("US"),"États-Unis");assert.equal(names.of("SE"),"Suède");assert.equal(names.of("NO"),"Norvège");assert.equal(names.of("NL"),"Pays-Bas");const sorted=SHIPPING_COUNTRY_CODES.map(code=>names.of(code)??code).sort((a,b)=>a.localeCompare(b,"fr"));for(const query of ["Suède","Norvège","États-Unis","Pays-Bas"])assert.ok(sorted.some(name=>name.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))),query);assert.ok(sorted.indexOf("Zimbabwe")>sorted.indexOf("Hongrie"));});

test("French advanced shipping copy has no English fallback",()=>{for(const key of Object.keys(advancedShippingMessages.en) as Array<keyof typeof advancedShippingMessages.en>)assert.notEqual(advancedShippingMessages.fr[key],advancedShippingMessages.en[key],key);assert.match(advancedShippingMessages.fr.freeThreshold,/Livraison gratuite à partir de/);});

test("advanced shipping copy has no English fallback in any localized locale",()=>{for(const [locale,messages] of Object.entries(advancedShippingMessages)){if(locale==="en")continue;for(const key of Object.keys(advancedShippingMessages.en) as Array<keyof typeof advancedShippingMessages.en>){assert.notEqual(messages[key],advancedShippingMessages.en[key],`${locale}:${key}`);const placeholders=(value:string)=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();assert.deepEqual(placeholders(messages[key]),placeholders(advancedShippingMessages.en[key]),`${locale}:${key}`);}}});

test("postal prefix, exact, country scope, and legacy wildcard are deterministic",()=>{const prefix=serializePostalRule({country:"FR",type:"PREFIX",value:"59"})!;assert.equal(prefix,"FR|PREFIX|59");assert.equal(postalRulesAllow([prefix],"FR","59000"),true);assert.equal(postalRulesAllow([prefix],"FR","59100"),true);assert.equal(postalRulesAllow([prefix],"FR","75001"),false);assert.equal(postalRulesAllow([prefix],"BE","59000"),true);const exact=serializePostalRule({country:"FR",type:"EXACT",value:"59000"})!;assert.equal(postalRulesAllow([exact],"FR","59000"),true);assert.equal(postalRulesAllow([exact],"FR","59100"),false);assert.deepEqual(parsePostalRule("59*"),{country:"*",type:"PREFIX",value:"59"});assert.equal(postalRulesAllow(["59*"],"FR","59000"),true);});

test("effective product postal override takes precedence",()=>{const product={...store,id:"override",shippingOverrideEnabled:true,shippingCountries:["FR"],shippingPostalCodes:["FR|EXACT|75001"]};assert.throws(()=>cartShippingQuote(store,[{product,subtotal:new Prisma.Decimal(10)}],"FR","59000"),/SHIPPING_POSTAL_UNAVAILABLE/);assert.equal(cartShippingQuote(store,[{product,subtotal:new Prisma.Decimal(10)}],"FR","75001").destinationCountry,"FR");});

test("checkout clears stale quotes and requotes saved-address changes",()=>{const source=readFileSync(join(process.cwd(),"app/checkout/page.tsx"),"utf8");assert.match(source,/\[address, items/);assert.match(source,/setQuote\(null\);setError\(""\)/);assert.match(source,/setTimeout\([\s\S]*shipping\/quote/);assert.match(source,/disabled=\{loading\|\|!quote\|\|!pricingResolved\}/);assert.doesNotMatch(source,/checkout-country/);});

test("checkout loads saved destination and identifies removable blocked lines",()=>{const checkout=readFileSync(join(process.cwd(),"app/checkout/page.tsx"),"utf8"),route=readFileSync(join(process.cwd(),"app/api/shipping/quote/route.ts"),"utf8");assert.match(checkout,/api\/account\/addresses/);assert.match(checkout,/setBlockedLines\(\{\}\)/);assert.match(checkout,/checkoutLineBlocked/);assert.match(checkout,/removeItem\(lineKey\)/);assert.match(route,/SHIPPING_LINES_UNAVAILABLE/);assert.match(route,/available:false/);assert.match(route,/allowedCountries/);});

test("shipping hotfix messages have 14-locale key and placeholder parity",()=>{assert.equal(Object.keys(shippingHotfixMessages).length,14);const reference=shippingHotfixMessages.en,placeholders=(value:string)=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();for(const [locale,messages] of Object.entries(shippingHotfixMessages)){assert.deepEqual(Object.keys(messages).sort(),Object.keys(reference).sort(),locale);for(const key of Object.keys(reference) as Array<keyof typeof reference>)assert.deepEqual(placeholders(messages[key]),placeholders(reference[key]),`${locale}:${key}`);}});
