import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultBuyerAddress } from "../lib/buyer-addresses";
import { accountProfileText } from "../i18n/account-profile";

const source = (path: string) => readFileSync(path, "utf8");

test("registration can persist an optional saved buyer address without making it required", () => {
  const registration = source("app/api/auth/register/route.ts");
  const form = source("app/register/RegisterForm.tsx");
  assert.doesNotMatch(form, /addressLine1|recipientName|LocalizedCountrySelect/);
  assert.match(registration, /createBuyerAddress\(tx, created\.id, input\.shippingAddress, true\)/);
  assert.match(registration, /prisma\.\$transaction/);
});

test("Account reads only the authenticated buyer default address and its phone", () => {
  const page = source("app/account/page.tsx");
  const settings = source("app/account/AccountSettings.tsx");
  assert.match(page, /where:\{id:session\.userId\}/);
  assert.match(page, /shippingAddresses:\{orderBy:\[\{isDefault:"desc"\},\{createdAt:"asc"\},\{id:"asc"\}\],take:1/);
  assert.match(page, /defaultAddress=\{shippingAddresses\[0\]\?\?null\}/);
  assert.match(settings, /defaultAddress\.phone/);
  assert.match(settings, /defaultAddress\.addressLine1/);
  assert.doesNotMatch(page, /addressId|searchParams/);
});

test("Account uses a safe empty state and the existing address manager for older buyers", () => {
  const settings = source("app/account/AccountSettings.tsx");
  assert.match(settings, /defaultAddress\?<address/);
  assert.match(settings, /t\("noSavedAddresses"\)/);
  assert.match(settings, /\$\{locale\}\/account\/addresses/);
});

test("personal profile editing is available to buyers and remains separate from shipping addresses", () => {
  const settings = source("app/account/AccountSettings.tsx");
  const profileRoute = source("app/api/account/profile/route.ts");
  assert.match(settings, /name="profileAddress"/);
  assert.match(settings, /name="profilePostalCode"/);
  assert.match(profileRoute, /data:validation\.value/);
  assert.doesNotMatch(profileRoute, /buyerShippingAddress/);
});

test("current email is session-owned and the email-change field starts empty without login autofill semantics", () => {
  const page = source("app/account/page.tsx");
  const settings = source("app/account/AccountSettings.tsx");
  assert.match(page, /where:\{id:session\.userId\}/);
  assert.match(settings, /<span>\{profile\.email\}<\/span>/);
  assert.match(settings, /name="requestedEmailChange" type="email" autoComplete="off" defaultValue=""/);
  assert.doesNotMatch(settings, /name="newEmail" type="email" autoComplete="email"/);
  assert.match(settings, /newEmail:form\.get\("requestedEmailChange"\)/);
  assert.match(source("app/login/page.tsx"), /name="email" type="email" autoComplete="email"/);
  assert.match(source("app/register/RegisterForm.tsx"), /name="email" type="email" autoComplete="email"/);
});

test("address ownership remains session-scoped for display, mutation, and checkout", async () => {
  let receivedWhere: unknown;
  const db = { buyerShippingAddress: { findFirst: async (args: { where: unknown }) => { receivedWhere = args.where; return null; } } };
  await defaultBuyerAddress(db as never, "buyer-a");
  assert.deepEqual(receivedWhere, { userId: "buyer-a" });
  const member = source("app/api/account/addresses/[id]/route.ts");
  assert.match(member, /userId:session\.userId/);
  assert.match(member, /deleteBuyerAddress\(tx,session\.userId/);
  const checkout = source("app/checkout/page.tsx");
  assert.match(checkout, /fetch\("\/api\/account\/addresses",\{cache:"no-store"\}\)/);
  assert.match(checkout, /setAddress\(data\.addresses\?\.\[0\]\?\?null\)/);
});

test("current-email label has localized parity for every supported locale", () => {
  for (const locale of ["ar", "de", "en", "es", "fa", "fr", "hi", "it", "ku", "nl", "pt", "ru", "tr", "zh"]) {
    assert.ok(accountProfileText(locale).currentEmail.trim());
  }
  assert.equal(accountProfileText("fr").currentEmail, "Adresse e-mail actuelle");
});
