import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminAccessError,
  activeAccessSource,
  calculateGrantPeriod,
  createManagedStore,
  extendManagedAccess,
  exemptExistingAdminStore,
  publicProductAccessWhere,
  publicStoreAccessWhere,
  requireAdmin,
} from "../lib/admin-access";
import { createAdditionalAdminManagedStore } from "../lib/admin-managed-store";

type Db = Parameters<typeof requireAdmin>[0];

test("non-admin and direct non-admin API identity are denied", async () => {
  const db = { user: { findUnique: async () => ({ id: "buyer", role: "CUSTOMER" }) } } as unknown as Db;
  await assert.rejects(() => requireAdmin(db, { userId: "buyer", role: "CUSTOMER" }), (error: unknown) => error instanceof AdminAccessError && error.status === 403);
});

test("admin authorization uses the current database role instead of a stale JWT role", async () => {
  const db = { user: { findUnique: async () => ({ id: "admin", role: "ADMIN" }) } } as unknown as Db;
  assert.deepEqual(await requireAdmin(db, { userId: "admin", role: "SELLER" }), { id: "admin", role: "ADMIN" });
  const stale = { user: { findUnique: async () => ({ id: "admin", role: "SELLER" }) } } as unknown as Db;
  await assert.rejects(() => requireAdmin(stale, { userId: "admin", role: "ADMIN" }));
});

test("admin creates an own permanent store without payment", async () => {
  let data: Record<string, unknown> | undefined;
  const db = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: "admin", role: "ADMIN", primaryStoreId: null, _count: { stores: 0 } }) },
    store: { create: async (input: { data: Record<string, unknown> }) => { data = input.data; return { id: "store-admin", slug: "admin-shop" }; } },
  } as unknown as Db;
  await createManagedStore(db, "admin", { ownerId: "admin", name: "Admin Shop", slug: "admin-shop", contactEmail: "admin@example.com", country: "FR", city: "Paris", currency: "EUR", language: "fr" });
  const nested = (data?.accessGrants as { create: { source: string; endsAt: Date | null } }).create;
  assert.equal(nested.source, "ADMIN_EXEMPT");
  assert.equal(nested.endsAt, null);
  assert.equal(data?.status, "ACTIVE");
});

test("admin creates an eligible seller store with timed access and no Stripe data", async () => {
  let data: Record<string, unknown> | undefined;
  const db = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: "seller", role: "SELLER", primaryStoreId: null, _count: { stores: 0 } }) },
    store: { create: async (input: { data: Record<string, unknown> }) => { data = input.data; return { id: "store-seller", slug: "seller-shop" }; } },
  } as unknown as Db;
  const now = new Date("2026-01-15T12:00:00Z");
  await createManagedStore(db, "admin", { ownerId: "seller", name: "Seller Shop", slug: "seller-shop", contactEmail: "seller@example.com", country: "FR", city: "Lyon", currency: "EUR", language: "fr", months: 3, plan: "plus" }, now);
  const nested = (data?.accessGrants as { create: { source: string; plan: string; endsAt: Date } }).create;
  assert.equal(nested.source, "ADMIN_GRANTED");
  assert.equal(nested.plan, "plus");
  assert.equal(nested.endsAt.toISOString(), "2026-04-15T12:00:00.000Z");
  assert.equal("subscription" in (data ?? {}), false);
});

test("admin creates an additional PRO Store inside the existing business without duplicating commercial identity", async () => {
  let created: Record<string, unknown> | undefined;
  const audits: Array<Record<string, unknown>> = [];
  const db = {
    user: { findUnique: async () => ({ id: "seller", role: "SELLER", primaryStoreId: null, _count: { stores: 1 }, sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null, ownedBusiness: { id: "business-1", maxStores: 3, _count: { stores: 1 } } }) },
    $queryRaw: async () => [{ id: "business-1", maxStores: 3 }],
    store: {
      count: async () => 1,
      create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: "store-2", slug: "second-shop" }; },
    },
    sellerBusiness: { findUnique: async () => ({ owner: { role: "SELLER" }, billingStore: { subscription: { status: "ACTIVE", plan: "pro",currentPeriodEnd:new Date("2026-02-01T00:00:00Z") }, accessGrants: [] } }) },
    sellerBusinessAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return data; } },
  } as never;
  const store = await createAdditionalAdminManagedStore(db, "admin", { ownerId: "seller", name: "Second Shop", slug: "second-shop", contactEmail: "seller@example.com", country: "FR", city: "Lyon", currency: "EUR", language: "fr" }, "business-1", new Date("2026-01-01T00:00:00Z"));
  assert.deepEqual(store, { id: "store-2", slug: "second-shop" });
  assert.equal(created?.ownerId, "seller");
  assert.equal(created?.businessId, "business-1");
  assert.equal("subscription" in (created ?? {}), false);
  assert.equal("accessGrants" in (created ?? {}), false);
  assert.equal(audits[0].action, "ADMIN_MANAGED_STORE_CREATED");
});

test("additional managed Store fails closed for non-PRO and at capacity", async () => {
  const database = (plan: string, count: number) => ({
    user: { findUnique: async () => ({ id: "seller", role: "SELLER", primaryStoreId: null, _count: { stores: count }, sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null, ownedBusiness: { id: "business-1", maxStores: 2, _count: { stores: count } } }) },
    $queryRaw: async () => [{ id: "business-1", maxStores: 2 }],
    store: { count: async () => count, create: async () => { throw new Error("must not create"); } },
    sellerBusiness: { findUnique: async () => ({ owner: { role: "SELLER" }, billingStore: { subscription: { status: "ACTIVE", plan,currentPeriodEnd:new Date("2099-01-01T00:00:00Z") }, accessGrants: [] } }) },
  }) as never;
  const input = { ownerId: "seller", name: "Second", slug: "second", contactEmail: "seller@example.com", country: "FR", city: "Lyon", currency: "EUR", language: "fr" };
  await assert.rejects(() => createAdditionalAdminManagedStore(database("free", 1), "admin", input, "business-1"), (error: unknown) => error instanceof AdminAccessError && error.code === "MULTI_STORE_PRO_REQUIRED");
  await assert.rejects(() => createAdditionalAdminManagedStore(database("plus", 1), "admin", input, "business-1"), (error: unknown) => error instanceof AdminAccessError && error.code === "MULTI_STORE_PRO_REQUIRED");
  await assert.rejects(() => createAdditionalAdminManagedStore(database("pro", 2), "admin", input, "business-1"), (error: unknown) => error instanceof AdminAccessError && error.code === "STORE_LIMIT_REACHED");
});

test("normal customer cannot receive an admin-created seller store", async () => {
  const db = { $queryRaw: async () => [], user: { findUnique: async () => ({ id: "buyer", role: "CUSTOMER", primaryStoreId: null, _count: { stores: 0 } }) } } as unknown as Db;
  await assert.rejects(() => createManagedStore(db, "admin", { ownerId: "buyer", name: "Shop", slug: "shop", contactEmail: "buyer@example.com", country: "FR", city: "Lyon", currency: "EUR", language: "fr", months: 1 }));
});

test("one and multiple calendar-month extensions use the current date when expired", () => {
  const now = new Date("2026-01-31T10:00:00Z");
  assert.equal(calculateGrantPeriod(now, 1, new Date("2025-12-01T00:00:00Z")).endsAt.toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(calculateGrantPeriod(now, 6, null).endsAt.toISOString(), "2026-07-31T10:00:00.000Z");
});

test("active access extends from the current expiry", () => {
  const period = calculateGrantPeriod(new Date("2026-01-01T00:00:00Z"), 3, new Date("2026-04-10T00:00:00Z"));
  assert.equal(period.startsAt.toISOString(), "2026-04-10T00:00:00.000Z");
  assert.equal(period.endsAt.toISOString(), "2026-07-10T00:00:00.000Z");
});

test("bulk extension creates one audit grant per store and leaves Stripe untouched", async () => {
  const created: Array<Record<string, unknown>> = [];
  let subscriptionTouched = false;
  const db = {
    $queryRaw: async () => [],
    store: { findUnique: async ({ where }: { where: { id: string } }) => ({ accessGrants: [], subscription: where.id === "one" ? { status: "ACTIVE", currentPeriodEnd: new Date("2026-02-01T00:00:00Z") } : null }), findMany: async () => [{ id: "one", accessGrants: [], subscription: { status: "ACTIVE", currentPeriodEnd: new Date("2026-02-01T00:00:00Z") } }, { id: "two", accessGrants: [], subscription: null }] },
    storeAccessGrant: { create: async (input: { data: Record<string, unknown> }) => { created.push(input.data); return { storeId: input.data.storeId, endsAt: input.data.endsAt }; } },
    product: { updateMany: async () => ({ count: 0 }) },
    sellerSubscription: { update: async () => { subscriptionTouched = true; } },
  } as unknown as Db;
  await extendManagedAccess(db, "admin", ["one", "two"], 12, new Date("2026-01-01T00:00:00Z"), "pro");
  assert.equal(created.length, 2);
  assert.equal((created[0].startsAt as Date).toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(created[0].plan, "pro");
  assert.equal(subscriptionTouched, false);
});

test("Admin grant targets the one business billing Store and is audited once",async()=>{
  const grants:any[]=[],audits:any[]=[];
  const billing={accessGrants:[],subscription:null};
  const db={$queryRaw:async()=>[],store:{findUnique:async()=>billing,findMany:async()=>[
    {id:"store-1",accessGrants:[],subscription:null,business:{id:"business",billingStoreId:"billing",billingStore:billing}},
    {id:"store-2",accessGrants:[],subscription:null,business:{id:"business",billingStoreId:"billing",billingStore:billing}},
  ]},storeAccessGrant:{create:async({data}:any)=>{grants.push(data);return{storeId:data.storeId,endsAt:data.endsAt};}},product:{updateMany:async()=>({count:0})},sellerBusinessAuditEvent:{create:async({data}:any)=>{audits.push(data);return data;}}}as never;
  await extendManagedAccess(db,"admin",["store-1","store-2"],3,new Date("2026-01-01T00:00:00Z"),"pro");
  assert.equal(grants.length,1);assert.equal(grants[0].storeId,"billing");assert.equal(audits.length,1);assert.equal(audits[0].action,"ADMIN_GRANT_CREATED");
});

test("invalid duration is rejected", () => {
  assert.throws(() => calculateGrantPeriod(new Date(), 2 as 1), (error: unknown) => error instanceof AdminAccessError && error.code === "INVALID_DURATION");
});

test("public FREE listings retain lifecycle, data isolation, supplier safety and five-product visibility", () => {
  const now = new Date("2026-01-01T00:00:00Z"), where = publicProductAccessWhere(now);
  assert.equal(where.dataClass, "PRODUCTION"); assert.equal(where.removedAt, null);
  assert.deepEqual(where.store, publicStoreAccessWhere(now));
  assert.deepEqual(where.OR, [{supplierLink:{is:null}},{supplierLink:{is:{supplierAvailable:true,syncStatus:"HEALTHY"}}}]);
  const serialized = JSON.stringify(where.NOT);
  assert.match(serialized, /freeVisibilityPosition/); assert.match(serialized, /"gt":5/);
  assert.match(serialized, /plus/); assert.match(serialized, /pro/);
  assert.match(serialized, /currentPeriodEnd/); assert.doesNotMatch(serialized, /basic/);
});

test("existing admin store exemption is permanent, idempotent, and does not touch Stripe", async () => {
  const created: Array<Record<string, unknown>> = [];
  let subscriptionTouched = false;
  const store = { id: "store-admin", owner: { role: "ADMIN" }, accessGrants: [] as Array<{ id: string; endsAt: Date | null }> };
  const db = {
    store: { findFirst: async () => store },
    storeAccessGrant: {
      create: async (input: { data: Record<string, unknown> }) => {
        created.push(input.data);
        store.accessGrants.push({ id: "grant-1", endsAt: input.data.endsAt as Date | null });
      },
      update: async () => undefined,
    },
    sellerSubscription: { update: async () => { subscriptionTouched = true; } },
  } as unknown as Db;
  const first = await exemptExistingAdminStore(db, "admin", new Date("2026-01-01T00:00:00Z"));
  const second = await exemptExistingAdminStore(db, "admin", new Date("2026-01-02T00:00:00Z"));
  assert.deepEqual(first, { storeId: "store-admin", created: true });
  assert.deepEqual(second, { storeId: "store-admin", created: false });
  assert.equal(created.length, 1);
  assert.equal(created[0].source, "ADMIN_EXEMPT");
  assert.equal(created[0].endsAt, null);
  assert.equal(subscriptionTouched, false);
});

test("admin exemption is displayed ahead of an active Stripe subscription", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.deepEqual(activeAccessSource({
    subscription: { status: "ACTIVE", currentPeriodEnd: new Date("2026-02-01T00:00:00Z") },
    accessGrants: [{ source: "ADMIN_EXEMPT", startsAt: now, endsAt: null }],
  }, now), { source: "ADMIN_EXEMPT", expiresAt: null });
});
