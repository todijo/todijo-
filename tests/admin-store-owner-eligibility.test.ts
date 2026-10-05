import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { managedOwnerEligibility, listManagedOwners, requireManagedOwner, type ManagedOwner } from "../lib/admin-store-owner-eligibility";
import { createManagedStore, requireAdmin } from "../lib/admin-access";
import { adminStoreOwnerCopy } from "../i18n/admin-store-owners";
import { assertAdminMutationRequest } from "../lib/request-security";

const seller: ManagedOwner = { id: "seller", firstName: "Seller", lastName: "Owner", email: "seller@example.test", role: "SELLER", primaryStoreId: null, store: null, sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null, _count: { stores: 0 }, ownedBusiness: null };
type Db = Parameters<typeof managedOwnerEligibility>[0];
const emptyDb = {} as Db;
test("unrestricted SELLER first-store eligible; CUSTOMER remains excluded", async () => {
  assert.equal((await managedOwnerEligibility(emptyDb, seller, "admin")).eligible, true);
  assert.equal((await managedOwnerEligibility(emptyDb, { ...seller, role: "CUSTOMER" }, "admin")).eligible, false);
});
test("first-store and additional-store restrictions fail closed", async () => {
  for (const restrictions of [{ sellerSuspendedAt: new Date() }, { deactivatedAt: new Date() }, { blockedAt: new Date(), blockExpiresAt: null }]) {
    for (const count of [0, 1]) assert.equal((await managedOwnerEligibility(emptyDb, { ...seller, ...restrictions, _count: { stores: count } }, "admin")).reason, "OWNER_RESTRICTED");
  }
});
test("expired block does not exclude an otherwise eligible seller", async () => {
  assert.equal((await managedOwnerEligibility(emptyDb, { ...seller, blockedAt: new Date(0), blockExpiresAt: new Date(1) }, "admin")).eligible, true);
});
test("Admin self first-store rule checks primary pointer AND total ownership", async () => {
  const admin = { ...seller, id: "admin", role: "ADMIN" as const };
  assert.equal((await managedOwnerEligibility(emptyDb, admin, "admin")).eligible, true);
  assert.equal((await managedOwnerEligibility(emptyDb, { ...admin, primaryStoreId: "primary" }, "admin")).eligible, false);
  assert.equal((await managedOwnerEligibility(emptyDb, { ...admin, _count: { stores: 2 } }, "admin")).mode, "ADDITIONAL");
});
test("Admin additional-store eligibility is independent of seller PRO and self-service capacity", async () => {
  const billingStore = { id: "billing", ownerId: "seller", businessId: "business" };
  const owner = { ...seller, _count: { stores: 2 }, ownedBusiness: { id: "business", billingStoreId: "billing", billingStore, _count: { stores: 2 } } };
  assert.equal((await managedOwnerEligibility(emptyDb, owner, "admin")).mode, "ADDITIONAL");
  assert.equal((await managedOwnerEligibility(emptyDb, { ...owner, ownedBusiness: { ...owner.ownedBusiness, _count: { stores: 3 } } }, "admin")).reason, "OWNER_BUSINESS_INCONSISTENT");
  assert.equal((await managedOwnerEligibility(emptyDb, { ...owner, ownedBusiness: { ...owner.ownedBusiness, billingStore: { ...billingStore, ownerId: "other" } } }, "admin")).reason, "OWNER_BUSINESS_INCONSISTENT");
  assert.equal((await managedOwnerEligibility(emptyDb, { ...owner, ownedBusiness: null }, "admin")).reason, "OWNER_BUSINESS_INCONSISTENT");
});
test("eligible-owner list excludes invalid owners, deduplicates and supports bounded search", async () => {
  let query: unknown;
  const db = { user: { findMany: async (input: unknown) => { query = input; return [seller, seller, { ...seller, id: "buyer", role: "CUSTOMER" }]; } } } as unknown as Db;
  assert.deepEqual((await listManagedOwners(db, "admin", " Seller ")).map(user => user.id), ["seller"]);
  const text = JSON.stringify(query);
  for (const field of ["firstName", "lastName", "email", "insensitive"]) assert.ok(text.includes(field));
  assert.ok(text.includes('"contains":"Seller"'));
});
test("mutation revalidates stale eligibility and invalid owner IDs", async () => {
  const db = (owner: ManagedOwner | null) => ({ user: { findUnique: async () => owner } }) as unknown as Db;
  await assert.rejects(() => requireManagedOwner(db({ ...seller, sellerSuspendedAt: new Date() }), "seller", "admin"), /OWNER_RESTRICTED/);
  await assert.rejects(() => requireManagedOwner(db(null), "forged", "admin"), /OWNER_NOT_FOUND/);
});
test("forged Admin session rejected; mutation origin requires same-origin action header", async () => {
  await assert.rejects(() => requireAdmin({ user: { findUnique: async () => seller } } as unknown as Db, { userId: "seller", role: "ADMIN" }));
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/stores")));
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/stores", { headers: { "x-todijo-admin-action": "1", origin: "https://evil.test" } })));
});
test("concurrent first-store creation serializes and second stale request fails", async () => {
  let count = 0, tail = Promise.resolve(), business: any = null;
  const owner: any = { ...seller };
  const tx: any = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ ...owner, _count: { stores: count } }), updateMany: async ({ data }: any) => { Object.assign(owner, data); return { count: 1 }; } },
    store: { create: async () => { count++; return { id: "created", slug: "created" }; }, updateMany: async () => ({ count: 1 }) },
    sellerBusiness: { upsert: async () => { business ??= { id: "business-created", billingStoreId: null, maxStores: 1, _count: { stores: 0 } }; business._count.stores = count; return business; }, update: async ({ data }: any) => { if (data.billingStoreId) { business.billingStoreId = data.billingStoreId; owner.store = { id: data.billingStoreId, ownerId: owner.id, businessId: business.id }; } } },
    sellerBusinessAuditEvent: { create: async ({ data }: any) => data },
  };
  const db = { $transaction: (run: (value: typeof tx) => Promise<unknown>) => {
    const result = tail.then(() => run(tx)); tail = result.then(() => undefined, () => undefined); return result;
  } } as unknown as Db;
  const input = { ownerId: "seller", name: "Shop", slug: "shop", contactEmail: seller.email, country: "FR", city: "Paris", currency: "EUR", language: "fr", months: 1 as const, plan: "free" as const };
  const results = await Promise.allSettled([createManagedStore(db, "admin", input), createManagedStore(db, "admin", input)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(count, 1);
});
test("selector exposes search/loading/error/empty without unrelated policy changes", () => {
  const ui = readFileSync("app/adm-barewbar-182203/AdminDashboard.tsx", "utf8");
  for (const text of ["ownerCopy.empty", "ownerCopy.loading", "ownerCopy.error", 'type="search"', "AbortController", "setSelectedOwner"]) assert.ok(ui.includes(text));
  for (const locale of ["fr", "en"]) for (const text of Object.values(adminStoreOwnerCopy(locale))) assert.ok(text.trim());
  const route = readFileSync("app/api/admin/stores/route.ts", "utf8");
  assert.ok(route.includes("assertAdminMutationRequest(request)"));
  const exemptMutation = route.slice(route.indexOf("export async function PUT"));
  assert.match(exemptMutation, /PUT\(request: Request\)/);
  assert.ok(exemptMutation.indexOf("requireAdmin(prisma, session)") < exemptMutation.indexOf("assertAdminMutationRequest(request)"));
  assert.ok(exemptMutation.indexOf("assertAdminMutationRequest(request)") < exemptMutation.indexOf("exemptExistingAdminStore"));
  assert.ok(route.indexOf("lockManagedOwner(tx") < route.indexOf("requireManagedOwner(tx"));
  assert.ok(readFileSync("lib/admin-store-owner-eligibility.ts", "utf8").includes("FOR UPDATE"));
  assert.ok(readFileSync("app/api/admin/store-owners/route.ts", "utf8").includes("requireAdmin"));
  assert.equal(adminStoreOwnerCopy("fr").empty, "Aucun vendeur ne peut actuellement être sélectionné : vérifiez que son compte est actif et que ses boutiques sont correctement rattachées.");
  assert.equal(adminStoreOwnerCopy("en").empty, "No seller can currently be selected: check that their account is active and their stores are correctly linked.");
});

test("Admin exemption mutation requires same-origin action marker", () => {
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/stores", { method: "PUT" })));
  assert.doesNotThrow(() => assertAdminMutationRequest(new Request("https://todijo.com/api/admin/stores", { method: "PUT", headers: { "x-todijo-admin-action": "1", origin: "https://todijo.com" } })));
});
