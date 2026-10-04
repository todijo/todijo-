import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSellerCommercialAccess, sellerCapabilityTier, hasProSellerCapabilities, canCreateAdditionalSellerStore } from "../lib/seller-commercial-access";
import { hasProTeamEntitlement } from "../lib/seller-business-access";
import { sellerProductQuota } from "../lib/seller-subscription";
import { issueSellerTeamInvitation } from "../lib/seller-team";
import { requireSellerSupplierAccess } from "../lib/suppliers/supplier-access";
import { managedOwnerEligibility, type ManagedOwner } from "../lib/admin-store-owner-eligibility";
import { adminAccessStatus } from "../lib/admin-access-status";

const now = new Date("2026-10-04"), future = new Date("2099-01-01");
function access(role: "ADMIN" | "SELLER", paid: string | null, grant: string | null, expiry = future) {
  return resolveSellerCommercialAccess({ role, subscription: paid ? { status: "ACTIVE", plan: paid, currentPeriodEnd: expiry } : null,
    accessGrants: grant ? [{ source: "ADMIN_GRANTED", plan: grant, startsAt: now, endsAt: expiry }] : [] }, now);
}
test("Admin exemption remains permanent non-paid access with PRO capabilities", () => {
  const result = access("ADMIN", null, null);
  assert.equal(result.source, "ADMIN_EXEMPT"); assert.equal(result.plan, "admin-exempt"); assert.equal(result.expiresAt, null); assert.equal(result.active, true);
  assert.equal(sellerCapabilityTier(result.plan), "pro"); assert.equal(hasProSellerCapabilities(result.plan), true);
  assert.deepEqual(sellerProductQuota({ role: "ADMIN", plan: result.plan, productCount: 99999 }), { productLimit: null, blocked: false });
  assert.equal(canCreateAdditionalSellerStore(result.plan), false);
});
for (const plan of ["basic", "plus", "pro"]) {
  for (const source of ["paid", "grant"]) test(`${source} ${plan} retains only its own capabilities`, () => {
    const result = access("SELLER", source === "paid" ? plan : null, source === "grant" ? plan : null);
    assert.equal(sellerCapabilityTier(result.plan), plan); assert.equal(hasProSellerCapabilities(result.plan), plan === "pro");
    assert.equal(result.source, source === "paid" ? "STRIPE" : "ADMIN_GRANTED"); assert.equal(result.expiresAt, future);
  });
}
test("expired, future and forged grants do not inherit exemption capabilities", () => {
  for (const result of [access("SELLER", null, "pro", now), access("SELLER", "pro", null, now), access("SELLER", null, "admin-exempt")]) {
    assert.equal(hasProSellerCapabilities(result.plan), false); assert.equal(sellerCapabilityTier(result.plan), null);
  }
  assert.equal(access("SELLER", "basic", "pro").plan, "basic");
});
test("Team permission gate permits Admin exemption and valid PRO but respects expiration and paid precedence", () => {
  const grant = { source: "ADMIN_GRANTED" as const, plan: "pro", startsAt: now, endsAt: future };
  assert.equal(hasProTeamEntitlement({ owner: { role: "ADMIN" }, billingStore: { subscription: null, accessGrants: [] } }, now), true);
  assert.equal(hasProTeamEntitlement({ owner: { role: "SELLER" }, billingStore: { subscription: null, accessGrants: [grant] } }, now), true);
  assert.equal(hasProTeamEntitlement({ owner: { role: "SELLER" }, billingStore: { subscription: { status: "ACTIVE", plan: "pro", currentPeriodEnd: now }, accessGrants: [] } }, now), false);
  assert.equal(hasProTeamEntitlement({ owner: { role: "SELLER" }, billingStore: { subscription: { status: "ACTIVE", plan: "basic", currentPeriodEnd: future }, accessGrants: [grant] } }, now), false);
});
test("Admin can issue Team invitation using existing scoped/audited service without subscription writes", async () => {
  const audits: unknown[] = [];
  const tx = {
    sellerBusiness: { findUnique: async ({ where }: { where: { ownerId?: string } }) => where.ownerId ? { id: "business", owner: { email: "admin@example.test" } } : { owner: { role: "ADMIN" }, billingStore: { id: "store", subscription: null, accessGrants: [] } } },
    sellerTeamMembership: { findFirst: async () => null, count: async () => 0 },
    sellerTeamInvitation: { findUnique: async () => null, count: async () => 0, upsert: async () => ({ id: "invite", email: "member@example.test", expiresAt: future }) },
    store: { count: async () => 1 }, $queryRaw: async () => [{ id: "business", maxStores: 3 }],
    sellerBusinessAuditEvent: { create: async (value: unknown) => { audits.push(value); return value; } },
  };
  const db = { $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) } as unknown as Parameters<typeof issueSellerTeamInvitation>[0];
  const result = await issueSellerTeamInvitation(db, { ownerId: "admin", email: "member@example.test", locale: "fr", roleTemplate: "PRODUCT_MANAGER", permissions: [], storeIds: ["store"] }, now);
  assert.equal(result.id, "invite"); assert.equal(audits.length, 1);
});
test("Admin dropshipping capability does not bypass explicit dropshipping permission", async () => {
  const store = { id: "store", ownerId: "admin", businessId: null, owner: { role: "ADMIN" }, subscription: null, accessGrants: [], dropshippingEnabled: true };
  const db = { store: { findFirst: async () => store } } as unknown as Parameters<typeof requireSellerSupplierAccess>[0];
  assert.equal((await requireSellerSupplierAccess(db, { userId: "admin" })).id, "store");
  store.dropshippingEnabled = false; await assert.rejects(() => requireSellerSupplierAccess(db, { userId: "admin" }), /DROPSHIPPING_PERMISSION_DENIED/);
});
test("one-store Admin exception stays authoritative regardless of PRO capability", async () => {
  const admin = { id: "admin", role: "ADMIN", primaryStoreId: null, _count: { stores: 0 }, ownedBusiness: null, sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null } as ManagedOwner;
  const db = {} as Parameters<typeof managedOwnerEligibility>[0];
  assert.equal((await managedOwnerEligibility(db, admin, "admin", now)).eligible, true);
  assert.equal((await managedOwnerEligibility(db, { ...admin, _count: { stores: 1 } }, "admin", now)).eligible, false);
  assert.equal((await managedOwnerEligibility(db, { ...admin, primaryStoreId: "primary" }, "admin", now)).eligible, false);
  assert.equal(canCreateAdditionalSellerStore("pro"), true); assert.equal(canCreateAdditionalSellerStore("admin-exempt"), false);
  const route = readFileSync("app/api/store/route.ts", "utf8");
  assert.ok(route.includes('owner?.role === "ADMIN" && firstStore'));
  assert.ok(route.indexOf('FROM "User"') < route.indexOf("const firstStore"));
  assert.ok(route.includes("await requireAdmin(tx, session)"));
  assert.ok(route.indexOf("assertAdminMutationRequest(request)") < route.indexOf("await ensureSellerBusiness"));
});
test("Admin display keeps billing tier empty and shows PRO capability separately", () => {
  const state = adminAccessStatus({ lifecycle: "ACTIVE", onboarding: "VERIFIED", access: access("ADMIN", null, null), billingStatus: null, connect: { sellerSuspendedAt: null, stripeAccountId: null, stripeOnboardingComplete: false, stripeChargesEnabled: false, stripePayoutsEnabled: false } });
  assert.equal(state.plan, null); assert.equal(state.capabilityTier, "PRO"); assert.equal(state.source, "ADMIN_EXEMPT"); assert.equal(state.expiresAt, null); assert.equal(state.billingStatus, null);
  const ui = readFileSync("components/AdminAccessStatus.tsx", "utf8"); assert.ok(ui.includes("state.capabilityTier")); assert.ok(ui.includes("copy.notRequired"));
});
