import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("seller onboarding exposes an explicit one-time personal-address copy option", () => {
  const form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(form, /buyerAddress \? <label className="sellerAddressReuse"/);
  assert.match(form, /type="checkbox" name="usePersonalAddress"/);
  assert.match(form, /setUsePersonalAddress\(event\.target\.checked\)/);
  assert.match(form, /useState\(false\)/);
  assert.match(form, /shownAddress = usePersonalAddress && buyerAddress/);
  assert.match(form, /readOnly=\{usePersonalAddress\}/);
  assert.match(form, /account\/addresses/);
});

test("the authenticated default buyer address is the only permitted copy source", () => {
  const page = source("app/seller/onboarding/page.tsx"), route = source("app/api/seller/onboarding/route.ts");
  assert.match(page, /defaultBuyerAddress\(prisma, session\.userId\)/);
  assert.match(route, /defaultBuyerAddress\(prisma,userId\)/);
  assert.doesNotMatch(route, /body\.(addressId|userId)/);
  assert.match(route, /PERSONAL_ADDRESS_NOT_FOUND/);
});

test("seller address persists independently without mutating or duplicating buyer addresses", () => {
  const route = source("app/api/seller/onboarding/route.ts");
  assert.match(route, /businessAddress:address,businessPostalCode:postalCode/);
  assert.match(route, /tx\.user\.update\(\{where:\{id:user\.id\},data:\{role:"SELLER"\}\}\)/);
  assert.doesNotMatch(route, /profileAddress|profilePostalCode|profileCity|profileCountry/);
  assert.doesNotMatch(route, /buyerShippingAddress\.(create|update|upsert|delete)/);
  assert.match(route, /const store=user\.store\?await tx\.store\.update/);
  assert.match(route, /:await tx\.store\.create/);
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
