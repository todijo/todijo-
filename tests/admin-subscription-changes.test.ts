import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminChangeStatuses, adminChangeOperations, adminSubscriptionChangeWhere, inspectAdminSubscriptionChanges } from "../lib/admin-subscription-changes";
import { adminSubscriptionChangesCopy } from "../i18n/admin-subscription-changes";

type Db = Parameters<typeof inspectAdminSubscriptionChanges>[0];
const now = new Date("2026-10-04"), expiry = new Date("2027-10-04");
function fixture(role = "ADMIN") {
  const queries: Array<Record<string, unknown>> = [];
  const store = { id: "store", name: "Seller shop", businessId: null, owner: { id: "seller", role: "SELLER", firstName: "Seller", lastName: "Owner", email: "seller@example.test" }, business: null,
    subscription: { status: "ACTIVE", plan: "pro", currentPeriodEnd: expiry }, accessGrants: [] };
  const rows = adminChangeStatuses.map((status, index) => ({ id: `change-${index}`, operation: "SCHEDULE", status, targetPlan: "free", targetBillingInterval: "monthly", sourcePlan: "pro", sourceBillingInterval: "annual", stripeInvoiceId: "in_test", stripeScheduleId: "sub_sched_test", createdAt: now,
    sellerSubscription: { id: "subscription", plan: "pro", billingInterval: "annual", status: "ACTIVE", currentPeriodEnd: expiry, store } }));
  const db = { user: { findUnique: async () => ({ id: "actor", role }) },
    sellerSubscriptionChange: { count: async (query: Record<string, unknown>) => { queries.push(query); return 45; }, findMany: async (query: Record<string, unknown>) => { queries.push(query); return rows; } },
    store: { findUnique: async () => store },
  } as unknown as Db;
  return { db, queries };
}
test("Admin inspection includes every status and preserves current versus requested plans", async () => {
  const { db } = fixture(); const result = await inspectAdminSubscriptionChanges(db, { userId: "actor" }, {}, now);
  assert.equal(result.rows.length, 7);
  for (const row of result.rows) { assert.equal(row.sellerSubscription.plan, "pro"); assert.equal(row.targetPlan, "free"); assert.equal(row.commercial.plan, "pro"); assert.equal(row.commercial.source, "PAID_SUBSCRIPTION"); assert.equal(row.stripeInvoiceId, "in_test"); assert.equal(row.stripeScheduleId, "sub_sched_test"); assert.deepEqual(row.actions, []); }
});
test("status and operation filters are allowlisted, with exact seller/store/subscription lookup", () => {
  for (const status of adminChangeStatuses) assert.equal(adminSubscriptionChangeWhere({ status }).status, status);
  for (const operation of adminChangeOperations) assert.equal(adminSubscriptionChangeWhere({ operation }).operation, operation);
  const where = adminSubscriptionChangeWhere({ status: "SCHEDULED", operation: "SCHEDULE", seller: "seller", store: "store", subscription: "subscription" });
  assert.deepEqual(where.sellerSubscription, { id: "subscription", store: { id: "store", ownerId: "seller" } });
  assert.throws(() => adminSubscriptionChangeWhere({ status: "PENDING" })); assert.throws(() => adminSubscriptionChangeWhere({ operation: "MARK_PAID" }));
});
test("history pagination is bounded and deterministically ordered", async () => {
  const state = fixture(); const result = await inspectAdminSubscriptionChanges(state.db, { userId: "actor" }, { page: "2" }, now);
  assert.equal(result.page, 2); assert.equal(result.pages, 3); assert.equal(result.skip, 20); assert.equal(result.take, 20);
  assert.deepEqual(state.queries[1].orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal((await inspectAdminSubscriptionChanges(state.db, { userId: "actor" }, { page: "999999" }, now)).page, 3);
});
test("PREPARED is unresolved without invented failure reason or action", async () => {
  const { db } = fixture(); const result = await inspectAdminSubscriptionChanges(db, { userId: "actor" }, {}, now);
  assert.equal(result.rows.find(row => row.status === "PREPARED")!.unresolved, true);
  assert.equal(result.rows.find(row => row.status === "FAILED")!.unresolved, false);
  assert.ok(!("failureReason" in result.rows[0]));
});
test("unauthenticated, non-Admin and forged session roles cannot inspect history", async () => {
  const state = fixture(); await assert.rejects(() => inspectAdminSubscriptionChanges(state.db, null, {}, now)); assert.equal(state.queries.length, 0);
  for (const role of ["SELLER", "CUSTOMER"]) {
    const denied = fixture(role); await assert.rejects(() => inspectAdminSubscriptionChanges(denied.db, { userId: "actor", role: "ADMIN" }, {}, now)); assert.equal(denied.queries.length, 0);
  }
});
test("search is bounded and includes seller names/email, shop and correlations", () => {
  const where = adminSubscriptionChangeWhere({ q: " x ".repeat(100) }); assert.ok(Array.isArray(where.OR));
  const source = JSON.stringify(where.OR); for (const key of ["stripeInvoiceId", "stripeScheduleId", "stripeSubscriptionId", "email", "firstName", "lastName", "name"]) assert.ok(source.includes(key));
  assert.ok(source.includes("insensitive"));
});
test("French and English labels distinguish every state and retain read-only warning", () => {
  for (const locale of ["fr", "en", "ar"]) {
    const copy = adminSubscriptionChangesCopy(locale); assert.equal(Object.keys(copy.statuses).length, 7); assert.equal(new Set(Object.values(copy.statuses)).size, 7); assert.ok(copy.readonly); assert.ok(copy.unresolved);
  }
});
test("inspection route has no mutation or manual payment/entitlement shortcut", () => {
  const route = readFileSync("app/api/admin/subscription-changes/route.ts", "utf8"), service = readFileSync("lib/admin-subscription-changes.ts", "utf8");
  assert.match(route, /export async function GET/); assert.doesNotMatch(route, /export async function (POST|PATCH|PUT|DELETE)/);
  assert.ok(route.includes("private, no-store")); assert.ok(service.includes("requireAdmin(db, session)"));
  assert.doesNotMatch(service, /\.update\(|\.create\(|\.delete\(|executeSellerSubscriptionChange\(|requestSellerSubscriptionChange\(|retrieveStripe|processSellerSubscriptionTransitionEvent\(/);
});
test("Admin UI shows correlation details, requested target separately and no action controls", () => {
  const page = readFileSync("app/adm-barewbar-182203/subscription-changes/page.tsx", "utf8");
  for (const token of ["row.sellerSubscription.plan", "row.targetPlan", "row.stripeInvoiceId", "row.stripeScheduleId", "<details>", "rtlLocales.has(locale)", "copy.readonly"]) assert.ok(page.includes(token));
  assert.doesNotMatch(page, /method="post"|markPaid|setApplied|executeSellerSubscriptionChange|requestSellerSubscriptionChange/);
  assert.ok(readFileSync("app/adm-barewbar-182203/page.tsx", "utf8").includes("/subscription-changes"));
});
