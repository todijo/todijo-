import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminEntryPath, localeFromReferer, localizedHome, postLoginDestination, safeLoginDestination } from "../lib/auth-redirects";
import { registrationPersistenceData, validateRegistrationInput } from "../lib/auth-registration";
import { verifyTurnstileTokenWith } from "../lib/turnstile-verification";
import { sellerOnboardingPath, sellerRegistrationIntent, sellerRegistrationIntentQuery } from "../lib/seller-registration-intent";

const validInput = { firstName: "Ada", lastName: "Lovelace", email: "ADA@EXAMPLE.COM", password: "password-123", confirmPassword: "password-123", role: "buyer", turnstileToken: "token", shippingAddress:{recipientName:"Ada Lovelace",addressLine1:"1 Computing Way",addressLine2:"",postalCode:"59000",city:"Lille",country:"fr",state:"",phone:""} };

function validationCode(input: unknown) {
  const result = validateRegistrationInput(input);
  return result.ok ? undefined : result.code;
}

test("registration validation requires matching passwords and never persists confirmation or Turnstile data", () => {
  const result = validateRegistrationInput(validInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.role, "CUSTOMER");
  assert.equal(result.value.email, "ada@example.com");
  assert.equal(result.value.shippingAddress?.country,"FR");
  assert.deepEqual(registrationPersistenceData(result.value), { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", role: "CUSTOMER", storeName: null });
  assert.equal("password" in registrationPersistenceData(result.value), false);
  assert.equal(validationCode({ ...validInput, confirmPassword: "different" }), "PASSWORD_MISMATCH");
  assert.equal(validationCode({ ...validInput, confirmPassword: "" }), "INVALID_FIELDS");
  assert.equal(validationCode({ ...validInput, role: "seller", storeName: "" }), "STORE_NAME_REQUIRED");
  assert.equal(validationCode({...validInput,shippingAddress:{...validInput.shippingAddress,postalCode:""}}),"INVALID_ADDRESS");
});

test("buyer registration creates a localized initial shipping address transactionally while seller registration remains unchanged",()=>{const form=readFileSync("app/register/RegisterForm.tsx","utf8"),route=readFileSync("app/api/auth/register/route.ts","utf8"),messages=readFileSync("i18n/buyer-address.ts","utf8");assert.match(form,/role === "customer"[\s\S]*shippingAddress/);assert.match(route,/prisma\.\$transaction/);assert.match(route,/createBuyerAddress\(tx, created\.id/);assert.match(messages,/Renseignez votre adresse avec précision/);assert.equal(validateRegistrationInput({...validInput,role:"seller",storeName:"Ada Shop",shippingAddress:undefined}).ok,true)});

test("Turnstile verification fails closed for missing, rejected, malformed, and unavailable verification", async () => {
  const accepted = await verifyTurnstileTokenWith("token", "secret", async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  assert.equal(accepted, "success");
  assert.equal(await verifyTurnstileTokenWith("", "secret", fetch), "missing");
  assert.equal(await verifyTurnstileTokenWith("token", undefined, fetch), "unavailable");
  assert.equal(await verifyTurnstileTokenWith("token", "secret", async () => new Response("no", { status: 403 })), "failed");
  assert.equal(await verifyTurnstileTokenWith("token", "secret", async () => new Response(JSON.stringify({ success: false }), { status: 200 })), "failed");
  assert.equal(await verifyTurnstileTokenWith("token", "secret", async () => { throw new DOMException("timeout", "AbortError"); }), "failed");
});

test("registration consumes a Turnstile token once and keeps the server verification authoritative", () => {
  const form = readFileSync("app/register/RegisterForm.tsx", "utf8");
  const route = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.match(form, /if \(submissionRef\.current\) return/);
  assert.match(form, /const verificationToken = tokenRef\.current/);
  assert.match(form, /tokenRef\.current = "";[\s\S]*turnstileToken: verificationToken/);
  assert.match(form, /resetVerification\(t\("verificationFailed"\)\)/);
  assert.match(route, /verifyTurnstileToken\(input\.turnstileToken\)/);
  assert.match(route, /if \(turnstile !== "success"\)/);
  assert.ok(route.indexOf("verifyTurnstileToken(input.turnstileToken)") < route.indexOf("prisma.user.findFirst"));
});

test("seller registration intent is canonical, localized, and fails closed for forged values", () => {
  assert.deepEqual(sellerRegistrationIntent("pro", undefined), { plan: "pro", interval: "monthly" });
  assert.deepEqual(sellerRegistrationIntent("plus", "annual"), { plan: "plus", interval: "annual" });
  assert.equal(sellerRegistrationIntent("enterprise", "monthly"), null);
  assert.equal(sellerRegistrationIntent("pro", "weekly"), null);
  assert.equal(sellerRegistrationIntentQuery(null), "");
  assert.equal(sellerOnboardingPath("fr", false, { plan: "pro", interval: "annual" }), "/fr/seller/create-store?plan=pro&interval=annual");
  assert.equal(sellerOnboardingPath("ku", true, { plan: "pro", interval: "monthly" }), "/ku/seller/subscription?plan=pro&interval=monthly");
  assert.equal(validationCode({ ...validInput, role: "seller", storeName: "Ada Shop", plan: "forged", interval: "monthly", shippingAddress: undefined }), "INVALID_SELLER_PLAN");
  const accepted = validateRegistrationInput({ ...validInput, role: "seller", storeName: "Ada Shop", plan: "pro", interval: "annual", shippingAddress: undefined });
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.deepEqual(accepted.value.sellerIntent, { plan: "pro", interval: "annual" });
});

test("seller intent survives registration and onboarding without granting an entitlement", () => {
  const form = readFileSync("app/register/RegisterForm.tsx", "utf8");
  const route = readFileSync("app/api/auth/register/route.ts", "utf8");
  const registerPage = readFileSync("app/register/page.tsx", "utf8");
  const createPage = readFileSync("app/seller/create-store/page.tsx", "utf8");
  const createForm = readFileSync("app/seller/create-store/CreateStoreForm.tsx", "utf8");
  const subscriptionPage = readFileSync("app/seller/subscription/page.tsx", "utf8");
  const checkout = readFileSync("app/api/seller/subscription/checkout/route.ts", "utf8");
  assert.match(form, /plan: role === "seller" \? params\?\.get\("plan"\)/);
  assert.match(route, /code: "ACCOUNT_EXISTS"/);
  assert.match(route, /sellerOnboardingPath\(locale, Boolean\(/);
  assert.match(route, /sellerOnboardingPath\(locale, false, input\.sellerIntent\)/);
  assert.match(registerPage, /session\.role !== "ADMIN"/);
  assert.match(createPage, /sellerRegistrationIntent\(query\.plan, query\.interval\)/);
  assert.match(createForm, /sellerOnboardingPath\(locale, true, sellerIntent\)/);
  assert.match(subscriptionPage, /initialPlanId=\{sellerIntent\?\.plan \?\? null\}/);
  assert.match(checkout, /configuredSellerPlan\(body\.planId, body\.interval\)/);
  assert.doesNotMatch(route, /SellerSubscription|sellerSubscription|entitlement/);
});

test("buyer and seller login destinations are localized and reject open redirects while admin uses the private route", () => {
  assert.equal(safeLoginDestination(null, "fr"), "/fr");
  assert.equal(safeLoginDestination("/messages?tab=all", "ku"), "/ku/messages?tab=all");
  assert.equal(safeLoginDestination("/fr/account/orders#latest", "de"), "/de/account/orders#latest");
  for (const destination of ["https://example.test", "//example.test", "\\\\example.test", "/api/auth/logout"]) assert.equal(safeLoginDestination(destination, "fr"), "/fr");
  for (const destination of ["/%2F%2Fevil.test", "/%5C%5Cevil.test", "/bad%zz", "/messages\u0000evil"]) assert.equal(safeLoginDestination(destination, "fr"), "/fr");
  assert.equal(postLoginDestination("CUSTOMER", null, "fr"), "/fr");
  assert.equal(postLoginDestination("SELLER", null, "ku"), "/ku");
  assert.equal(adminEntryPath("fr"), "/fr/adm-barewbar-182203");
  assert.equal(postLoginDestination("ADMIN", "/messages", "fr"), "/fr/adm-barewbar-182203");
  assert.equal(localizedHome(localeFromReferer("https://todijo.test/fr/dashboard")), "/fr");
  assert.equal(localizedHome(localeFromReferer("https://todijo.test/ku/seller/orders")), "/ku");
  assert.equal(localizedHome(localeFromReferer("not a URL")), "/en");
});

test("login and registration entry points preserve localized defaults and canonical seller onboarding", () => {
  const loginPage = readFileSync("app/login/page.tsx", "utf8");
  const loginLayout = readFileSync("app/login/layout.tsx", "utf8");
  const registerForm = readFileSync("app/register/RegisterForm.tsx", "utf8");
  const registerPage = readFileSync("app/register/page.tsx", "utf8");

  assert.match(loginPage, /postLoginDestination\(data\.role, params\?\.get\("next"\) \?\? null, locale as Locale\)/);
  assert.match(loginLayout, /redirect\(localizedHome\(await getLocale\(\)\)\)/);
  assert.match(registerForm, /router\.push\(data\.next \?\? localizedHome\(locale\)\)/);
  assert.match(registerPage, /redirect\(localizedHome\(locale\)\)/);
  assert.match(registerPage, /redirect\(sellerOnboardingPath\(locale, Boolean\(store\), intent\)\)/);
  assert.doesNotMatch(loginLayout, /redirect\("\/dashboard"\)/);
  assert.doesNotMatch(registerPage, /redirect\("\/dashboard"\)/);
});
