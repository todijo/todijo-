import test from "node:test";
import assert from "node:assert/strict";
import { canPublish, effectiveSellerPlan, sellerProductQuota } from "../lib/seller-subscription";
import { sellerBusinessCommercialEntitlement } from "../lib/seller-business";

test("publishing requires an active legally ready seller; FREE does not require a paid subscription", () => {
  const end=new Date(Date.now()+60_000);
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "ACTIVE",currentPeriodEnd:end } }), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "TRIALING",currentPeriodEnd:end } }), true);
  assert.equal(canPublish({ status: "PENDING", subscription: { status: "ACTIVE",currentPeriodEnd:end } }), false);
  assert.equal(canPublish({ status: "ACTIVE", subscription: { status: "PAST_DUE" } }), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null }), true);
});

test("admin-granted and admin-exempt stores can publish without a Stripe subscription", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_EXEMPT", startsAt: now, endsAt: null }] }, now), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), true);
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", startsAt: new Date("2025-01-01T00:00:00Z"), endsAt: now }] }, now), true);
});

test("normal seller still requires a valid seller state even without a paid plan", () => {
  assert.equal(canPublish({ status: "ACTIVE", subscription: null, accessGrants: [] }), true);
});

test("product quotas fail closed and preserve the all-products count semantics", () => {
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "free", productCount: 4 }), { productLimit: 5, blocked: false });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "free", productCount: 5 }), { productLimit: 5, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "plus", productCount: 50 }), { productLimit: 50, blocked: true });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "pro", productCount: 500 }), { productLimit: null, blocked: false });
  assert.deepEqual(sellerProductQuota({ role: "SELLER", plan: "forged", productCount: 0 }), { productLimit: null, blocked: true });
});

test("authoritative active Stripe plan wins and plan-level Admin grants work without Stripe", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: { status: "ACTIVE", plan: "plus",currentPeriodEnd:new Date("2026-02-01T00:00:00Z") }, accessGrants: [{ source: "ADMIN_GRANTED", plan: "pro", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), "plus");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", plan: "free", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), "free");
  assert.equal(effectiveSellerPlan({ role: "SELLER", subscription: null, accessGrants: [{ source: "ADMIN_GRANTED", plan: "forged", startsAt: now, endsAt: new Date("2026-02-01T00:00:00Z") }] }, now), "free");
});

test("every Store resolves the one billing Store commercial entitlement", async () => {
  const stripeEnd=new Date("2026-02-01T00:00:00Z"),stripeNow=new Date("2026-01-01T00:00:00Z"),stripeDb={sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"billing",subscription:{status:"ACTIVE",plan:"pro",currentPeriodEnd:stripeEnd},accessGrants:[]}})}} as never;
  assert.deepEqual(await sellerBusinessCommercialEntitlement(stripeDb,"business",stripeNow),{businessId:"business",billingStoreId:"billing",active:true,plan:"pro",source:"STRIPE",expiresAt:stripeEnd});
  assert.equal((await sellerBusinessCommercialEntitlement(stripeDb,"business",stripeEnd)).plan,"free");
  const expires=new Date("2026-02-01T00:00:00Z"),now=new Date("2026-01-01T00:00:00Z");
  const grantDb={sellerBusiness:{findUnique:async()=>({owner:{role:"SELLER"},billingStore:{id:"billing",subscription:null,accessGrants:[{source:"ADMIN_GRANTED",plan:"pro",startsAt:now,endsAt:expires}]}})}} as never;
  assert.deepEqual(await sellerBusinessCommercialEntitlement(grantDb,"business",now),{businessId:"business",billingStoreId:"billing",active:true,plan:"pro",source:"ADMIN_GRANTED",expiresAt:expires});
  assert.equal((await sellerBusinessCommercialEntitlement(grantDb,"business",expires)).plan,"free");
});
