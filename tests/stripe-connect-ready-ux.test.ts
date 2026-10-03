import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {connectPaymentCopy} from "../i18n/connect-payment";

const source=readFileSync("components/StripeConnectSection.tsx","utf8");

test("only all four authoritative flags define the ready state",()=>{
  assert.match(source,/status\.connected && status\.onboardingComplete && status\.chargesEnabled && status\.payoutsEnabled/);
  assert.match(source,/const ready = isStripeConnectReady\(status\)/);
});

test("ready UI clears stale errors and exposes no onboarding CTA",()=>{
  assert.match(source,/if\(isStripeConnectReady\(result\)\)setError\(""\)/);
  assert.match(source,/if\(ready\)\{setError\(""\);setBusy\(false\)\}/);
  assert.match(source,/\{!ready&&error && <p className="formError"/);
  assert.match(source,/\{!ready&&<button className="quickActionLink primary"/);
  assert.doesNotMatch(connectPaymentCopy("fr").ready,/Impossible de connecter Stripe|Reprendre l’inscription/);
  assert.equal(connectPaymentCopy("fr").ready,"Stripe est configuré");
  assert.equal(connectPaymentCopy("en").ready,"Stripe is configured");
});

test("incomplete accounts retain configure or resume behavior",()=>{
  assert.match(source,/status\.connected \? t\("resume"\) : paymentCopy\.configure/);
  assert.match(source,/onClick=\{onboard\}/);
});

test("ready without commercial entitlement retains the subscription warning",()=>{
  assert.match(source,/ready&&!commercialEntitlementActive&&<p className="subscriptionWarning"/);
  assert.ok(connectPaymentCopy("fr").readyNoPlan.includes("abonnement"));
  assert.ok(connectPaymentCopy("en").readyNoPlan.includes("subscription"));
});
