import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveSellerPersonalAddress } from "../lib/seller-onboarding-address";

const source = (path: string) => readFileSync(path, "utf8");

test("seller onboarding exposes an explicit one-time personal-address copy option", () => {
  const form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(form, /buyerAddress \? <label className="sellerAddressReuse"/);
  assert.match(form, /type="checkbox" name="usePersonalAddress"/);
  assert.match(form, /setUsePersonalAddress\(event\.target\.checked\)/);
  assert.match(form, /useState\(initial\.samePersonalBusinessAddress\)/);
  assert.match(form, /shownAddress = usePersonalAddress && buyerAddress/);
  assert.match(form, /readOnly=\{usePersonalAddress\}/);
  assert.match(form, /account\/addresses/);
});

test("the authenticated personal profile is preferred and saved buyer address is a safe fallback", () => {
  const page = source("app/seller/onboarding/page.tsx"), route = source("app/api/seller/onboarding/route.ts");
  assert.match(page, /defaultBuyerAddress\(prisma, session\.userId\)/);
  assert.match(route, /defaultBuyerAddress\(prisma,\s*userId\)/);
  assert.match(page, /resolveSellerPersonalAddress\(buyerAddress, user\)/);
  assert.match(route, /resolveSellerPersonalAddress\(shippingAddress,\s*profile,\s*text\(body\.phone,\s*40\)\s*\?\?\s*""\)/);
  assert.doesNotMatch(route, /body\.(addressId|userId)/);
  assert.match(route, /PERSONAL_ADDRESS_NOT_FOUND/);
});

test("personal address resolution prefers the account profile and does not mutate its sources", () => {
  const profile = { profileAddress: "12 Home Street", profilePostalCode: "75001", profileCity: "Paris", profileCountry: "FR", phone: "0102030405" };
  const shipping = { addressLine1: "9 Shipping Road", addressLine2: null, postalCode: "69001", city: "Lyon", country: "FR", phone: null };
  const profileSnapshot = structuredClone(profile), shippingSnapshot = structuredClone(shipping);
  assert.deepEqual(resolveSellerPersonalAddress(shipping, profile), { address: "12 Home Street", postalCode: "75001", city: "Paris", country: "FR", phone: "0102030405" });
  assert.deepEqual(profile, profileSnapshot);
  assert.deepEqual(shipping, shippingSnapshot);
});

test("a saved shipping address is used only when the personal profile is incomplete", () => {
  const profile = { profileAddress: null, profilePostalCode: null, profileCity: null, profileCountry: null, phone: "0102030405" };
  const shipping = { addressLine1: "9 Shipping Road", addressLine2: "B", postalCode: "69001", city: "Lyon", country: "fr", phone: null };
  assert.deepEqual(resolveSellerPersonalAddress(shipping, profile), { address: "9 Shipping Road, B", postalCode: "69001", city: "Lyon", country: "FR", phone: "0102030405" });
  assert.equal(resolveSellerPersonalAddress(null, profile), null);
});

test("seller address persists independently without mutating or duplicating buyer addresses", () => {
  const route = source("app/api/seller/onboarding/route.ts");
  assert.match(route, /businessAddress:\s*address,\s*businessPostalCode:\s*postalCode/);
  assert.match(route, /tx\.user\.update\(\{\s*where:\s*\{\s*id:\s*user\.id\s*\},\s*data:\s*\{\s*role:\s*"SELLER"\s*\}\s*\}\)/);
  assert.doesNotMatch(route, /data:\{[^}]*profile(Address|PostalCode|City|Country)/);
  assert.doesNotMatch(route, /buyerShippingAddress\.(create|update|upsert|delete)/);
  assert.match(route, /const store = user\.store\s*\?\s*await tx\.store\.update/);
  assert.match(route, /:\s*await tx\.store\.create/);
});

test("address reuse copy remains separate from seller plan continuity and checkout", () => {
  const page = source("app/seller/onboarding/page.tsx"), route = source("app/api/seller/onboarding/route.ts");
  assert.match(page, /explicitSellerRegistrationIntent\(query\.plan, query\.interval\)/);
  assert.match(page, /sellerOnboardingPath/);
  assert.doesNotMatch(route, /stripe|subscription|checkout|AdminAccessGrant|buyerShippingAddress\.create/);
});

test("all Auth locales provide the address-reuse and safe-fallback copy", () => {
  for (const locale of ["ar","de","en","es","fa","fr","hi","it","ku","nl","pt","ru","tr","zh"]) {
    const messages = JSON.parse(source(`messages/auth/${locale}.json`));
    for (const key of ["sameAsPersonalAddress","sameAsPersonalAddressHelp","noPersonalAddress","managePersonalAddress"]) assert.equal(typeof messages[key], "string", `${locale}.${key}`);
  }
});
