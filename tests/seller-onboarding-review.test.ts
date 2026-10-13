import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales } from "../i18n/config";
import { sellerReviewMessages, sellerReviewStateLabel } from "../i18n/seller-review";
import { reviewSellerOnboarding, SellerReviewError } from "../lib/seller-onboarding-review";
import { requireAdmin } from "../lib/admin-access";
import { assertAdminMutationRequest } from "../lib/request-security";

test("Admin review rejects non-admin and forged session roles", async () => {
  for (const role of ["CUSTOMER", "SELLER"]) {
    await assert.rejects(() => requireAdmin({ user: { findUnique: async () => ({ id: "user", role }) } } as never, { userId: "user", role: "ADMIN" }));
  }
});
test("Admin review requires same-origin action protection", () => {
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/seller-onboarding/store")));
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/seller-onboarding/store", { headers: { "x-todijo-admin-action": "1", origin: "https://evil.example" } })));
  assert.doesNotThrow(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/seller-onboarding/store", { headers: { "x-todijo-admin-action": "1", origin: "https://todijo.com" } })));
});

const validStore={id:"store",businessId:"business",status:"PENDING",onboardingStatus:"PENDING_REVIEW",onboardingStep:4,country:"FR",sellerType:"PRIVATE",sellerLegalForm:"PRIVATE",companySubtype:null,businessRegistrationId:null,legalBusinessName:null,businessAddress:"1 rue",businessPostalCode:"75001",vatStatus:"NOT_REGISTERED_OR_NOT_APPLICABLE",vatNumber:null,owner:{id:"seller",role:"SELLER",emailVerified:true}};
function database(store={...validStore}){const updates:any[]=[],audits:any[]=[],events:any[]=[];return{db:{store:{findUnique:async()=>store,updateMany:async(input:any)=>{updates.push(input);return{count:1};}},sellerBusinessAuditEvent:{create:async(input:any)=>{audits.push(input);return{};}},accountSecurityEvent:{create:async(input:any)=>{events.push(input);return{};}}}as never,updates,audits,events};}

test("Admin legal review completes exceptional verification but leaves selling pending separate readiness",async()=>{const state=database();const result=await reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"Identity reviewed"});assert.deepEqual(result,{changed:true,status:"VERIFIED"});assert.equal(state.updates[0].data.status,"PENDING");assert.equal(state.updates[0].data.onboardingStatus,"VERIFIED");assert.equal(state.audits[0].data.action,"SELLER_VERIFIED");assert.equal(state.audits[0].data.metadata.newStatus,"PENDING");assert.equal(state.events.length,1);assert.equal("subscription" in state.updates[0].data,false);});
test("invalid or incomplete seller verification fails closed",async()=>{const state=database({...validStore,onboardingStep:3});await assert.rejects(()=>reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"review"}),(error:unknown)=>error instanceof SellerReviewError&&error.code==="SELLER_PREREQUISITES_INCOMPLETE");assert.equal(state.updates.length,0);});
test("repeated completed approval is idempotent for pending Connect activation and creates no duplicate audit",async()=>{const state=database({...validStore,status:"PENDING",onboardingStatus:"VERIFIED"});assert.deepEqual(await reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"repeat"}),{changed:false,status:"VERIFIED"});assert.equal(state.updates.length,0);assert.equal(state.audits.length,0);});
test("pending rejection and correction preserve commercial and product state", async () => {
  for (const decision of ["REJECTED", "NEEDS_INFORMATION"] as const) {
    const state = database();
    await reviewSellerOnboarding(state.db, { storeId: "store", adminId: "admin", decision, reason: "Reviewed" });
    assert.deepEqual(Object.keys(state.updates[0].data).sort(), ["onboardingStatus", "status"]);
    assert.equal(state.audits[0].data.metadata.previousStatus, "PENDING");
    assert.equal(state.audits[0].data.metadata.newStatus, decision === "REJECTED" ? "REJECTED" : "PENDING");
    assert.equal(state.audits[0].data.actorId, "admin");
  }
});
test("a rejected application can be reconsidered only through an audited Admin decision", async () => {
  const state = database({ ...validStore, status: "REJECTED", onboardingStatus: "REJECTED" });
  const result = await reviewSellerOnboarding(state.db, { storeId: "store", adminId: "admin", decision: "NEEDS_INFORMATION", reason: "Seller may resubmit corrected evidence" });
  assert.deepEqual(result, { changed: true, status: "NEEDS_INFORMATION" });
  assert.deepEqual(state.updates[0].where, { id: "store", status: "REJECTED", onboardingStatus: "REJECTED", updatedAt: undefined });
  assert.deepEqual(state.updates[0].data, { onboardingStatus: "NEEDS_INFORMATION", status: "PENDING" });
  assert.equal(state.audits[0].data.metadata.previousStatus, "REJECTED");
  assert.equal(state.audits[0].data.metadata.reason, "Seller may resubmit corrected evidence");
});
test("manual INSEE approval does not invalidate its own optimistic Store update", async () => {
  const calls: string[] = [], storeUpdates: any[] = [], audits: any[] = [];
  const store = {
    ...validStore, status: "PENDING", onboardingStatus: "PENDING_REVIEW", sellerType: "PROFESSIONAL",
    sellerLegalForm: "SOLE_TRADER", businessRegistrationId: "73282932000074", legalBusinessName: "Example Ltd",
    vatStatus: "NOT_REGISTERED_OR_NOT_APPLICABLE", establishmentId: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    business: { siren: "732829320", inseeVerificationState: "MANUAL_REVIEW", inseeLegalUnitName: "Example Ltd" },
  };
  const tx = {
    store: {
      findUnique: async () => store,
      update: async () => { calls.push("store.update"); throw new Error("premature store write"); },
      updateMany: async (input: any) => { calls.push("store.updateMany"); storeUpdates.push(input); return { count: 1 }; },
    },
    sellerBusiness: { update: async () => { calls.push("business.update"); return {}; } },
    sellerVerificationDocument: { findFirst: async () => ({ id: "accepted-registration-document", status: "ACCEPTED" }) },
    sellerBusinessEstablishment: {
      findUnique: async () => ({ id: "establishment", legalUnitSiren: "732829320", verificationState: "MANUAL_REVIEW" }),
      update: async () => { calls.push("establishment.update"); return {}; },
    },
    sellerBusinessAuditEvent: { create: async (input: any) => { audits.push(input); return {}; } },
    accountSecurityEvent: { create: async () => ({}) },
  };
  const result = await reviewSellerOnboarding(tx as never, { storeId: "store", adminId: "admin", decision: "VERIFIED", reason: "Manual business evidence reviewed" });
  assert.deepEqual(result, { changed: true, status: "VERIFIED" });
  assert.deepEqual(calls, ["business.update", "establishment.update", "store.updateMany"]);
  assert.equal(storeUpdates[0].where.updatedAt, store.updatedAt);
  assert.equal(storeUpdates[0].data.establishmentId, "establishment");
  assert.equal(storeUpdates[0].data.status, "PENDING");
  assert.ok(audits.some(event => event.data.action === "INSEE_ADMIN_MANUAL_VERIFIED" && event.data.metadata.reason === "Manual business evidence reviewed"));
  assert.ok(audits.some(event => event.data.action === "SELLER_VERIFIED"));
});
test("active suspended and unsubmitted stores cannot be reset through pending review", async () => {
  for (const store of [{ ...validStore, status: "ACTIVE", onboardingStatus: "VERIFIED" }, { ...validStore, status: "SUSPENDED" }, { ...validStore, onboardingStatus: "NOT_STARTED" }]) {
    const state = database(store);
    await assert.rejects(() => reviewSellerOnboarding(state.db, { storeId: "store", adminId: "admin", decision: "REJECTED", reason: "review" }), /REVIEW_STATE_INVALID/);
    assert.equal(state.updates.length, 0);
  }
});
test("concurrent state change fails closed before audit", async () => {
  const state = database();
  (state.db as any).store.updateMany = async () => ({ count: 0 });
  await assert.rejects(() => reviewSellerOnboarding(state.db, { storeId: "store", adminId: "admin", decision: "VERIFIED", reason: "review" }), /REVIEW_STATE_CHANGED/);
  assert.equal(state.audits.length, 0);
});
test("pending Admin inspection exposes context without Stripe calls", () => {
  const page = readFileSync(join(process.cwd(), "app/adm-barewbar-182203/seller-review/page.tsx"), "utf8");
  assert.match(page, /status: "PENDING"/);
  for (const field of ["readManagedCommercialSummary", "adminAccessStatus", "billingInterval", "currentPeriodEnd", "stripeChargesEnabled", "stripePayoutsEnabled", "onboardingStatus"]) assert.ok(page.includes(field));
  assert.doesNotMatch(page, /retrieveStripe|createConnectedAccount|sellerSubscriptionChange/);
});
test("Admin review remains discoverable, localized, and RTL-aware",()=>{for(const locale of locales){const copy=sellerReviewMessages[locale];for(const value of Object.values(copy))assert.ok(value.trim(),`${locale} review copy`);}const admin=readFileSync(join(process.cwd(),"app/adm-barewbar-182203/page.tsx"),"utf8"),page=readFileSync(join(process.cwd(),"app/adm-barewbar-182203/seller-review/page.tsx"),"utf8"),actions=readFileSync(join(process.cwd(),"app/adm-barewbar-182203/seller-review/SellerReviewActions.tsx"),"utf8");assert.match(admin,/seller-review/);assert.match(page,/rtlLocales\.has\(locale\)/);assert.match(actions,/role="status"/);assert.doesNotMatch(actions,/>Verify<|>Reject<|placeholder="Review reason"/);});
test("seller sees the exact saved Admin evidence request on the resumable onboarding form",()=>{const page=readFileSync(join(process.cwd(),"app/seller/onboarding/page.tsx"),"utf8"),form=readFileSync(join(process.cwd(),"app/seller/onboarding/SellerAddressOnboardingForm.tsx"),"utf8"),review=readFileSync(join(process.cwd(),"lib/seller-onboarding-review.ts"),"utf8");assert.match(review,/metadata:\{reason:input\.reason/);assert.match(page,/action:"SELLER_NEEDS_INFORMATION"/);assert.match(page,/adminReviewReason/);assert.match(form,/adminReview&&/);assert.match(form,/adminReview\.reason/);});
test("INSEE refusal reason is shown to seller, successful legal verification reconciles, and Admin errors are surfaced", () => {
  const page = readFileSync(join(process.cwd(), "app/seller/onboarding/page.tsx"), "utf8");
  const form = readFileSync(join(process.cwd(), "app/seller/onboarding/SellerAddressOnboardingForm.tsx"), "utf8");
  const verificationRoute = readFileSync(join(process.cwd(), "app/api/seller/business/verification/route.ts"), "utf8");
  const actions = readFileSync(join(process.cwd(), "app/adm-barewbar-182203/seller-review/SellerReviewActions.tsx"), "utf8");
  assert.match(page, /businessVerificationReason/);
  assert.match(form, /verificationReasonMessage/);
  assert.match(form, /SELLER_BUSINESS_VERIFICATION_REQUIRED.*verificationRequired/);
  assert.match(verificationRoute, /reconcilePendingSellerStoreActivationsForOwner/);
  assert.match(actions, /safeCode/);
});
test("Admin seller readiness displays localized known states and preserves unknown state identity", () => {
  assert.equal(sellerReviewStateLabel("fr", "onboarding", "PENDING_REVIEW"), "En attente de validation");
  assert.equal(sellerReviewStateLabel("fr", "sellerType", "PROFESSIONAL"), "Professionnel");
  assert.equal(sellerReviewStateLabel("fr", "verification", "INSEE_NEW_STATE"), "État inconnu (INSEE_NEW_STATE)");
  assert.equal(sellerReviewStateLabel("en", "vat", "REGISTERED"), "Registered");
  const page = readFileSync(join(process.cwd(), "app/adm-barewbar-182203/seller-review/page.tsx"), "utf8");
  assert.match(page, /stateLabel\("verification",\s*store\.business\?\.inseeVerificationState\)/);
  assert.match(page, /countryLabel\(store\.country\)/);
  assert.doesNotMatch(page, /\{store\.onboardingStatus\}|\{store\.owner\.role\}|\{store\.vatStatus\}/);
});
