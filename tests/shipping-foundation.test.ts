import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { cartShippingQuote, parseShippingSettings, ShippingError, shippingQuote } from "../lib/shipping";
import { advancedShippingMessages } from "../i18n/shipping-advanced";

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
