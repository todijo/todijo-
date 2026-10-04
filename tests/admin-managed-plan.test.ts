import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { changeManagedGrantPlan, readManagedCommercialState } from "../lib/admin-managed-plan";
import { resolveSellerCommercialAccess } from "../lib/seller-commercial-access";
import { sellerProductQuota } from "../lib/seller-subscription";
import { sellerPlanEntitlement } from "../lib/seller-plans";
import { assertAdminMutationRequest } from "../lib/request-security";
const now = new Date("2026-10-04T12:00:00Z"), expiry = new Date("2027-10-03T12:00:00Z");
function fixture(plan = "basic", linked = true) {
  const store: any = { id: "store", ownerId: "seller", businessId: linked ? "business" : null, owner: { id: "seller", role: "SELLER" }, business: linked ? { billingStoreId: "store", ownerId: "seller" } : null, subscription: null, accessGrants: [{ id: "grant", source: "ADMIN_GRANTED", plan, startsAt: new Date("2026-01-01"), endsAt: expiry }] };
  const owner: any = { id: "seller", role: "SELLER", primaryStoreId: linked ? "store" : null, ownedBusiness: linked ? { id: "business", billingStoreId: "store", _count: { stores: 1 } } : null };
  const audits: any[] = [], writes: any[] = [];
  let created = 0, tail = Promise.resolve();
  const tx: any = {
    $queryRaw: async () => [],
    user: { findUnique: async ({ where }: any) => where.id === "admin" ? { id: "admin", role: "ADMIN" } : owner, updateMany: async () => { if (!owner.primaryStoreId) owner.primaryStoreId = store.id; return { count: 1 }; } },
    store: { findUnique: async () => store, updateMany: async ({ where, data }: any) => { if (where.ownerId !== store.ownerId) return { count: 0 }; store.businessId = data.businessId; store.business = { billingStoreId: store.id, ownerId: "seller" }; return { count: 1 }; } },
    sellerBusiness: {
      upsert: async () => { if (!owner.ownedBusiness) { created++; owner.ownedBusiness = { id: "business", billingStoreId: store.id, maxStores: 1, _count: { stores: 1 } }; } return { ...owner.ownedBusiness, maxStores: 1 }; },
      update: async ({ data }: any) => { owner.ownedBusiness.billingStoreId = data.billingStoreId; },
    },
    storeAccessGrant: { updateMany: async ({ where, data }: any) => {
      const grant = store.accessGrants.find((item: any) => item.id === where.id && item.plan === where.plan);
      if (!grant) return { count: 0 }; writes.push(data); grant.plan = data.plan; return { count: 1 };
    } },
    sellerBusinessAuditEvent: { count: async () => audits.filter(row => row.action === "ADMIN_GRANT_PLAN_CHANGED").length, create: async ({ data }: any) => { audits.push(data); return data; } },
  };
  const db: any = { ...tx, $transaction: (run: any) => {
    const result = tail.then(async () => {
      const snapshot = structuredClone({ store, owner, audits, writes, created });
      try { return await run(tx); } catch (error) { Object.assign(store, snapshot.store); Object.assign(owner, snapshot.owner); audits.splice(0, audits.length, ...snapshot.audits); writes.splice(0, writes.length, ...snapshot.writes); created = snapshot.created; throw error; }
    });
    tail = result.then(() => undefined, () => undefined); return result;
  } };
  return { db, tx, store, owner, audits, writes, created: () => created };
}
async function input(state: ReturnType<typeof fixture>, plan: string) { return { storeId: "store", plan, version: (await readManagedCommercialState(state.db, "store", now)).version }; }
for (const [from, to] of [["basic","plus"],["basic","pro"],["plus","basic"],["plus","pro"],["pro","basic"],["pro","plus"]]) {
  test(`immediate Admin grant ${from} to ${to} preserves dates and audits`, async () => {
    const state = fixture(from), before = state.store.accessGrants[0].startsAt;
    await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, to), now);
    assert.equal(state.store.accessGrants[0].plan, to);
    assert.equal(state.store.accessGrants[0].startsAt.getTime(), before.getTime());
    assert.equal(state.store.accessGrants[0].endsAt.getTime(), expiry.getTime());
    assert.equal(state.store.accessGrants.length, 1);
    assert.equal(state.audits[0].metadata.previousEffectiveTier, from);
    assert.equal(state.audits[0].actorId, "admin");
    assert.equal(state.store.subscription, null);
  });
}
test("managed first store links once with safe initial primary/billing identity", async () => {
  const state = fixture("basic", false);
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "pro"), now);
  assert.equal(state.created(), 1); assert.equal(state.owner.primaryStoreId, "store");
  assert.equal(state.owner.ownedBusiness.billingStoreId, "store"); assert.equal(state.store.businessId, "business");
  assert.deepEqual(state.audits.map(row => row.action), ["ADMIN_MANAGED_BUSINESS_LINKED", "ADMIN_GRANT_PLAN_CHANGED"]);
});
test("existing unlinked business reused without primary/billing reassignment", async () => {
  const state = fixture("basic", false);
  state.owner.primaryStoreId = "store"; state.owner.ownedBusiness = { id: "existing", billingStoreId: "store", _count: { stores: 0 } };
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "plus"), now);
  assert.equal(state.created(), 0); assert.equal(state.store.businessId, "existing");
  assert.equal(state.owner.ownedBusiness.billingStoreId, "store"); assert.equal(state.owner.primaryStoreId, "store");
});
test("linked business is unchanged and never upserted", async () => {
  const state = fixture(), before = structuredClone(state.owner);
  state.tx.sellerBusiness.upsert = async () => { throw new Error("must not link"); };
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "pro"), now);
  assert.deepEqual(state.owner, before);
});
test("conflicting primary/billing ownership rejects without linking", async () => {
  for (const conflict of ["primary", "billing", "owner"]) {
    const state = fixture("basic", false);
    if (conflict === "primary") state.owner.primaryStoreId = "other";
    if (conflict === "billing") state.owner.ownedBusiness = { id: "business", billingStoreId: "other", _count: { stores: 1 } };
    if (conflict === "owner") state.owner.id = "different";
    await assert.rejects(() => input(state, "pro").then(value => changeManagedGrantPlan(state.db, { userId: "admin" }, value, now)));
    assert.equal(state.created(), 0); assert.equal(state.store.accessGrants[0].plan, "basic"); assert.equal(state.audits.length, 0);
  }
});
test("concurrent linking/tier requests use one identity and reject stale second write", async () => {
  const state = fixture("basic", false), request = await input(state, "pro");
  const results = await Promise.allSettled([changeManagedGrantPlan(state.db, { userId: "admin" }, request, now), changeManagedGrantPlan(state.db, { userId: "admin" }, request, now)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1); assert.equal(state.created(), 1);
});
test("future extension tiers aligned without changing dates; overlapping active grants rejected", async () => {
  const state = fixture();
  state.store.accessGrants.push({ id: "future", source: "ADMIN_GRANTED", plan: "basic", startsAt: expiry, endsAt: new Date("2028-10-03") });
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "pro"), now);
  assert.deepEqual(state.store.accessGrants.map((row: any) => row.plan), ["pro", "pro"]);
  assert.equal(state.store.accessGrants[1].startsAt.getTime(), expiry.getTime());
  const overlapping = fixture(); overlapping.store.accessGrants.push({ ...overlapping.store.accessGrants[0], id: "duplicate" });
  await assert.rejects(() => input(overlapping, "pro").then(value => changeManagedGrantPlan(overlapping.db, { userId: "admin" }, value, now)), /Overlapping/);
});
test("paid plan precedence, exemption and expiry are preserved", async () => {
  for (const plan of ["basic", "plus", "pro"]) {
    const state = fixture("pro"); state.store.subscription = { status: "ACTIVE", plan, currentPeriodEnd: expiry };
    assert.equal((await readManagedCommercialState(state.db, "store", now)).access.plan, plan);
    await assert.rejects(() => input(state, "plus").then(value => changeManagedGrantPlan(state.db, { userId: "admin" }, value, now)), /Only active Admin/);
    assert.equal(state.store.subscription.plan, plan);
  }
  assert.equal(resolveSellerCommercialAccess({ role: "ADMIN", subscription: null, accessGrants: [] }, now).plan, "admin-exempt");
  assert.equal(resolveSellerCommercialAccess({ role: "SELLER", subscription: null, accessGrants: fixture().store.accessGrants }, expiry).active, false);
});
test("lower quota preserves data and PRO plan-gated capabilities follow resolved tier", async () => {
  const state = fixture("pro");
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "basic"), now);
  const plan = (await readManagedCommercialState(state.db, "store", now)).access.plan;
  assert.equal(sellerProductQuota({ role: "SELLER", plan, productCount: 60 }).blocked, true);
  assert.equal(sellerPlanEntitlement(plan)?.dropshipping, false);
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "pro"), now);
  assert.equal(sellerPlanEntitlement((await readManagedCommercialState(state.db, "store", now)).access.plan)?.dropshipping, true);
  assert.ok(state.writes.every(row => Object.keys(row).join() === "plan"));
});
test("non-Admin, invalid tier, stale writes and cross-origin mutations fail closed", async () => {
  const state = fixture();
  await assert.rejects(() => input(state, "pro").then(value => changeManagedGrantPlan(state.db, { userId: "seller" }, value, now)));
  await assert.rejects(() => changeManagedGrantPlan(state.db, { userId: "admin" }, { storeId: "store", plan: "forged", version: "" }, now));
  await assert.rejects(() => changeManagedGrantPlan(state.db, { userId: "admin" }, { storeId: "store", plan: "pro", version: "stale" }, now));
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/stores/plan", { headers: { "x-todijo-admin-action": "1", origin: "https://evil.test" } })));
  assert.equal(state.writes.length, 0);
});
test("audit failure rolls back identity and grant change", async () => {
  const state = fixture("basic", false);
  state.tx.sellerBusinessAuditEvent.create = async () => { throw new Error("audit failure"); };
  await assert.rejects(() => input(state, "pro").then(value => changeManagedGrantPlan(state.db, { userId: "admin" }, value, now)));
  assert.equal(state.store.businessId, null); assert.equal(state.created(), 0); assert.equal(state.store.accessGrants[0].plan, "basic");
});
test("a newly scheduled extension invalidates a stale immediate-change request", async () => {
  const state = fixture(), request = await input(state, "pro");
  state.store.accessGrants.push({ id: "extension", source: "ADMIN_GRANTED", plan: "plus", startsAt: expiry, endsAt: new Date("2028-10-03") });
  await assert.rejects(() => changeManagedGrantPlan(state.db, { userId: "admin" }, request, now), /Refresh before/);
  assert.equal(state.writes.length, 0);
  const service = readFileSync("lib/admin-managed-plan.ts", "utf8"), extension = readFileSync("lib/admin-access.ts", "utf8");
  assert.ok(service.includes("lockAdminGrant(tx")); assert.ok(extension.includes("lockAdminGrant(db"));
});
test("failed grant CAS rejects and leaves identity/audit unchanged", async () => {
  const state = fixture("basic", false);
  state.tx.storeAccessGrant.updateMany = async () => ({ count: 0 });
  await assert.rejects(() => input(state, "pro").then(value => changeManagedGrantPlan(state.db, { userId: "admin" }, value, now)), /Grant changed concurrently/);
  assert.equal(state.store.businessId, null); assert.equal(state.created(), 0); assert.equal(state.audits.length, 0);
});
test("returning to the original tier does not revive an old UI token", async () => {
  const state = fixture(), original = await input(state, "plus");
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "pro"), now);
  await changeManagedGrantPlan(state.db, { userId: "admin" }, await input(state, "basic"), now);
  await assert.rejects(() => changeManagedGrantPlan(state.db, { userId: "admin" }, original, now), /Refresh before/);
});
test("Admin directory distinguishes effective tier and billing; action is confirmation protected", () => {
  const page = readFileSync("app/adm-barewbar-182203/page.tsx", "utf8"), ui = readFileSync("app/adm-barewbar-182203/AdminDashboard.tsx", "utf8");
  assert.ok(page.includes("readManagedCommercialSummary")); assert.ok(ui.includes("store.effectivePlan")); assert.ok(ui.includes("planCopy.billing"));
  const control = readFileSync("components/AdminManagedPlanControl.tsx", "utf8");
  assert.ok(control.includes("window.confirm")); assert.ok(control.includes('source !== "ADMIN_GRANTED"')); assert.ok(control.includes('plan ?? ""'));
});
