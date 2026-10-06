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

test("Admin verification validates, activates, and audits without fabricating entitlement",async()=>{const state=database();const result=await reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"Identity reviewed"});assert.deepEqual(result,{changed:true,status:"VERIFIED"});assert.equal(state.updates[0].data.status,"ACTIVE");assert.equal(state.updates[0].data.onboardingStatus,"VERIFIED");assert.equal(state.audits[0].data.action,"SELLER_VERIFIED");assert.equal(state.events.length,1);assert.equal("subscription" in state.updates[0].data,false);});
test("invalid or incomplete seller verification fails closed",async()=>{const state=database({...validStore,onboardingStep:3});await assert.rejects(()=>reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"review"}),(error:unknown)=>error instanceof SellerReviewError&&error.code==="SELLER_PREREQUISITES_INCOMPLETE");assert.equal(state.updates.length,0);});
test("repeated completed approval is idempotent and creates no duplicate audit",async()=>{const state=database({...validStore,status:"ACTIVE",onboardingStatus:"VERIFIED"});assert.deepEqual(await reviewSellerOnboarding(state.db,{storeId:"store",adminId:"admin",decision:"VERIFIED",reason:"repeat"}),{changed:false,status:"VERIFIED"});assert.equal(state.updates.length,0);assert.equal(state.audits.length,0);});
test("pending rejection and correction preserve commercial and product state", async () => {
  for (const decision of ["REJECTED", "NEEDS_INFORMATION"] as const) {
    const state = database();
    await reviewSellerOnboarding(state.db, { storeId: "store", adminId: "admin", decision, reason: "Reviewed" });
    assert.deepEqual(Object.keys(state.updates[0].data).sort(), ["marketplaceActivatedAt", "onboardingStatus", "status"]);
    assert.equal(state.audits[0].data.metadata.previousStatus, "PENDING");
    assert.equal(state.audits[0].data.metadata.newStatus, decision === "REJECTED" ? "REJECTED" : "PENDING");
    assert.equal(state.audits[0].data.actorId, "admin");
  }
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
