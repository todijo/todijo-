import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminEntryPath, localeFromReferer, localizedHome, postLoginDestination, safeLoginDestination } from "../lib/auth-redirects";
import { registrationPersistenceData, validateRegistrationInput } from "../lib/auth-registration";
import { verifyTurnstileTokenWith } from "../lib/turnstile-verification";
import { explicitSellerRegistrationIntent, sellerOnboardingPath, sellerRegistrationIntent, sellerRegistrationIntentQuery } from "../lib/seller-registration-intent";

const validInput = { firstName: "Ada", lastName: "Lovelace", email: "ADA@EXAMPLE.COM", password: "password-123", confirmPassword: "password-123", role: "buyer", turnstileToken: "token", shippingAddress:{recipientName:"Ada Lovelace",addressLine1:"1 Computing Way",addressLine2:"",postalCode:"59000",city:"Lille",country:"fr",state:"",phone:""} };

function validationCode(input: unknown) {
  const result = validateRegistrationInput(input);
  return result.ok ? undefined : result.code;
}

test("simple registration creates only a normal buyer and does not require role, address, phone, or password confirmation", () => {
  const result = validateRegistrationInput({ firstName: "Ada", lastName: "Lovelace", email: "ADA@EXAMPLE.COM", password: "password-123", turnstileToken: "token" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.role, "CUSTOMER");
  assert.equal(result.value.email, "ada@example.com");
  assert.equal(result.value.shippingAddress, null);
  assert.deepEqual(registrationPersistenceData(result.value), { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", role: "CUSTOMER" });
  assert.equal("password" in registrationPersistenceData(result.value), false);
  assert.equal(validationCode({ ...validInput, confirmPassword: "different" }), "PASSWORD_MISMATCH");
  assert.equal(validationCode({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", password: "password-123", role: "seller", storeName: "Legacy Shop", turnstileToken: "token" }), undefined);
  assert.equal(validationCode({...validInput,shippingAddress:{...validInput.shippingAddress,postalCode:""}}),"INVALID_ADDRESS");
});

test("web registration stays simple while an explicitly supplied optional shipping address remains supported",()=>{const form=readFileSync("app/register/RegisterForm.tsx","utf8"),route=readFileSync("app/api/auth/register/route.ts","utf8");assert.doesNotMatch(form,/registrationAddress|addressLine1|recipientName|name="role"|storeName/);assert.match(route,/if \(input\.role === "CUSTOMER" && input\.shippingAddress\) await createBuyerAddress\(tx, created\.id, input\.shippingAddress, true\)/);assert.equal(validateRegistrationInput({...validInput,shippingAddress:undefined}).ok,true);assert.equal(validateRegistrationInput(validInput).ok,true)});

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

test("legacy plan query remains validated and its seller intent is deferred without creating a seller account", () => {
  assert.deepEqual(sellerRegistrationIntent("pro", undefined), { plan: "pro", interval: "monthly" });
  assert.deepEqual(sellerRegistrationIntent("plus", "annual"), { plan: "plus", interval: "annual" });
  assert.equal(explicitSellerRegistrationIntent("pro", undefined), null);
  assert.deepEqual(explicitSellerRegistrationIntent("plus", "annual"), { plan: "plus", interval: "annual" });
  assert.equal(sellerRegistrationIntent("enterprise", "monthly"), null);
  assert.equal(sellerRegistrationIntent("pro", "weekly"), null);
  assert.equal(sellerRegistrationIntentQuery(null), "");
  assert.equal(sellerOnboardingPath("fr", false, { plan: "pro", interval: "annual" }), "/fr/seller/onboarding?plan=pro&interval=annual");
  assert.equal(sellerOnboardingPath("ku", true, { plan: "pro", interval: "monthly" }), "/ku/seller/subscription?plan=pro&interval=monthly");
  assert.equal(validationCode({ ...validInput, plan: "forged", interval: "monthly", shippingAddress: undefined }), "INVALID_SELLER_PLAN");
  const accepted = validateRegistrationInput({ ...validInput, role: "seller", storeName: "Ada Shop", plan: "pro", interval: "annual", shippingAddress: undefined });
  assert.equal(accepted.ok, true);
  if (accepted.ok) { assert.deepEqual(accepted.value.sellerIntent, { plan: "pro", interval: "annual" }); assert.equal(accepted.value.role,"CUSTOMER"); }
});

test("seller intent survives registration and onboarding without granting an entitlement", () => {
  const form = readFileSync("app/register/RegisterForm.tsx", "utf8");
  const route = readFileSync("app/api/auth/register/route.ts", "utf8");
  const registerPage = readFileSync("app/register/page.tsx", "utf8");
  const createPage = readFileSync("app/seller/create-store/page.tsx", "utf8");
  const createForm = readFileSync("app/seller/create-store/CreateStoreForm.tsx", "utf8");
  const subscriptionPage = readFileSync("app/seller/subscription/page.tsx", "utf8");
  const checkout = readFileSync("app/api/seller/subscription/checkout/route.ts", "utf8");
  assert.match(form, /next: registrationNext/);
  assert.doesNotMatch(form, /setRole|name="role"|role:\s*role/);
  assert.match(route, /code: "ACCOUNT_EXISTS"/);
  assert.match(route, /safeLoginDestination\(body\.next, locale\)/);
  assert.match(route, /createSession\(\{ userId: user\.id, role: user\.role/);
  assert.match(registerPage, /query\.next \? safeLoginDestination/);
  assert.match(createPage, /explicitSellerRegistrationIntent\(query\.plan, query\.interval\)/);
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
  assert.match(registerPage, /redirect\(query\.next \? safeLoginDestination/);
  assert.match(registerPage, /redirect\(sellerOnboardingPath\(locale, Boolean\(store\), intent\)\)/);
  assert.doesNotMatch(loginLayout, /redirect\("\/dashboard"\)/);
  assert.doesNotMatch(registerPage, /redirect\("\/dashboard"\)/);
});

test("successful email verification automatically continues through the safe destination or login continuation", () => {
  const route = readFileSync("app/api/auth/verify-email/route.ts", "utf8");
  assert.match(route, /result\.status==="success"/);
  assert.match(route, /safeLoginDestination\(nextValue,locale\)/);
  assert.match(route, /currentSession\?\.userId===result\.userId\?continuation/);
  assert.match(route, /sellerOnboardingDestination\(/);
  const flow = readFileSync("lib/seller-onboarding-flow.ts", "utf8");
  assert.match(flow, /"REJECTED"/);
  const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
  assert.match(dashboard, /verify-email\?next=/);
  assert.match(dashboard, /seller\/onboarding/);
});
