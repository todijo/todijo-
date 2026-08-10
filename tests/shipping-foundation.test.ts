import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { parseShippingSettings, ShippingError, shippingQuote } from "../lib/shipping";

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

test("migration is additive and keeps existing sellers safely disabled", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260810210000_add_shipping_foundation/migration.sql"), "utf8");
  assert.match(sql, /shippingEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /shippingCountries" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
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
