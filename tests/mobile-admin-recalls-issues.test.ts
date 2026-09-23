import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recallKeys, gtinRecallKeys, assertNotRecalled, createPlatformRecall, releaseRecallListing, ProductRecallError } from "../lib/product-recalls";
import { decideAdminOrderIssue, AdminIssueDecisionError } from "../lib/admin-order-issue-decision";

const source = (path: string) => readFileSync(path, "utf8");

test("recall identity uses exact provider-issued product, variant and SKU keys only", () => {
  assert.deepEqual(recallKeys({ provider: "CJ", supplierProductId: " p-1 ", supplierSku: "sku", variants: [{ supplierVariantId: "v-1", supplierSku: "sku" }, { supplierVariantId: "v-2" }] }), [
    { provider: "CJ", kind: "PRODUCT", value: "p-1" },
    { provider: "CJ", kind: "SKU", value: "sku" },
    { provider: "CJ", kind: "VARIANT", value: "v-1" },
    { provider: "CJ", kind: "VARIANT", value: "v-2" },
  ]);
  assert.deepEqual(recallKeys({ provider: "CJ" }), []);
});

test("checksum-valid GTIN is the only shared local-listing key; arbitrary text and bad checksums are ignored", () => {
  assert.deepEqual(gtinRecallKeys("4006381333931"), [{ provider: "GTIN", kind: "PRODUCT", value: "04006381333931" }]);
  assert.deepEqual(gtinRecallKeys("04006381333931"), gtinRecallKeys("4006381333931"));
  assert.deepEqual(gtinRecallKeys("4006381333932"), []);
  assert.deepEqual(gtinRecallKeys("summer-blazer"), []);
  assert.match(source("app/api/products/route.ts"), /const recallIdentity = gtinRecallKeys\(compliance\.productIdentifier\)/);
  assert.match(source("app/api/products/route.ts"), /assertNotRecalled\(tx, recallIdentity\)/);
  assert.match(source("app/api/products/[id]/route.ts"), /gtinRecallKeys\(compliance\.productIdentifier\)/);
});

test("an active platform recall fails closed before supplier import or publication", async () => {
  const db = { productRecall: { findFirst: async () => ({ id: "recall", reference: "R-1" }) } };
  await assert.rejects(assertNotRecalled(db as never, [{ provider: "CJ", kind: "PRODUCT", value: "p-1" }]), (error: unknown) => error instanceof ProductRecallError && error.code === "PRODUCT_RECALLED");
  const importSource = source("lib/suppliers/supplier-products.ts");
  const updateSource = source("app/api/products/[id]/route.ts");
  assert.match(importSource, /assertNotRecalled\(db,safetyKeys\)/);
  assert.match(importSource, /assertNotRecalled\(tx,safetyKeys\)/);
  assert.match(updateSource, /status === "PUBLISHED"[\s\S]*assertNotRecalled\(tx/);
  assert.match(source("app/api/mobile/seller/cj/route.ts"), /assertNotRecalled\(prisma/);
  assert.match(source("lib/suppliers/supplier-catalog-jobs.ts"), /code==="PRODUCT_RECALLED"/);
});

test("recall activation and revocation are audited and never silently republish", () => {
  const recalls = source("lib/product-recalls.ts");
  assert.match(recalls, /status: "DRAFT", deactivationReason: "ADMIN"/);
  assert.match(recalls, /action: "ACTIVATED"/);
  assert.match(recalls, /action: "REVOKED"/);
  assert.doesNotMatch(recalls, /status: "PUBLISHED"/);
  for (const route of ["app/api/mobile/admin/recalls/route.ts", "app/api/mobile/admin/recalls/[id]/route.ts"]) {
    assert.match(source(route), /requireMobileAdmin\(request\)/);
  }
  assert.match(source("prisma/schema.prisma"), /@@unique\(\[provider, kind, value\]\)/);
  const migration = source("prisma/migrations/20260923210000_add_platform_recalls_and_admin_issue_states/migration.sql");
  assert.match(migration, /CREATE TABLE "ProductRecall"/);
  assert.match(migration, /CREATE TABLE "ProductRecallKey"/);
  assert.match(migration, /CREATE TABLE "ProductRecallEvent"/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
});

test("one recall holds every exact supplier-linked listing across stores in the same transaction", async () => {
  const affected = [
    { id: "a", storeId: "seller-a", deactivationReason: "NONE", store: { ownerId: "owner-a", name: "A" } },
    { id: "b", storeId: "seller-b", deactivationReason: "SELLER", store: { ownerId: "owner-b", name: "B" } },
  ];
  let where: unknown;
  let hold: unknown;
  let created: unknown;
  const tx = {
    product: {
      findMany: async (input: { where: unknown }) => { where = input.where; return affected; },
      updateMany: async (input: unknown) => { hold = input; return { count: 2 }; },
    },
    productRecall: { create: async (input: unknown) => { created = input; return { id: "recall-1" }; } },
  };
  const db = {
    product: { findUnique: async () => ({ id: "a", supplierLink: { provider: "CJ", supplierProductId: "PID", supplierSku: "SKU" }, variants: [{ supplierVariantId: "VID", supplierSku: "VAR-SKU" }] }) },
    productRecallKey: { findFirst: async () => null },
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const result = await createPlatformRecall(db as never, "admin", { productId: "a", reason: "Regulator recall", reference: "R-1" });
  assert.deepEqual(result.affected.map(item => item.storeId), ["seller-a", "seller-b"]);
  assert.match(JSON.stringify(where), /"supplierProductId":\{"in":\["PID"\]\}/);
  assert.deepEqual((hold as { where: { id: { in: string[] } }; data: unknown }).where.id.in, ["a", "b"]);
  assert.deepEqual((hold as { data: unknown }).data, { status: "DRAFT", deactivationReason: "ADMIN" });
  const data = (created as { data: { events: { create: { actorId: string; action: string; metadata: { affected: Array<{ id: string; priorReason: string }> } } }; keys: { create: unknown[] } } }).data;
  assert.deepEqual(data.events.create.metadata.affected, [{ id: "a", priorReason: "NONE" }, { id: "b", priorReason: "SELLER" }]);
  assert.equal(data.events.create.actorId, "admin");
  assert.equal(data.keys.create.length, 4);
});

test("revoked recall requires a separate audited listing release, never auto-publishes", async () => {
  let update: unknown;
  let event: unknown;
  const tx = {
    productRecall: { findUnique: async () => ({ status: "REVOKED", events: [{ createdAt: new Date("2026-09-23T00:00:00Z"), metadata: { affected: [{ id: "a", priorReason: "NONE" }] } }] }) },
    product: {
      findUnique: async () => ({ id: "a", removedAt: null, deactivationReason: "ADMIN", productIdentifier: null, supplierLink: null, variants: [], reports: [] }),
      updateMany: async (value: unknown) => { update = value; return { count: 1 }; },
    },
    productRecallEvent: { create: async (value: unknown) => { event = value; return { id: "audit" }; } },
  };
  const db = { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) };
  const result = await releaseRecallListing(db as never, "admin", "recall", "a", "Explicit review completed");
  assert.deepEqual(result, { productId: "a", status: "DRAFT", deactivationReason: "SELLER" });
  assert.deepEqual((update as { data: unknown }).data, { deactivationReason: "SELLER" });
  assert.equal((event as { data: { actorId: string; action: string } }).data.actorId, "admin");
  assert.equal((event as { data: { actorId: string; action: string } }).data.action, "LISTING_RELEASED");
});

test("admin issue decision writes previous/new status and identity in one transaction without financial action", async () => {
  const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
  const tx = {
    orderIssue: {
      findUnique: async () => ({ id: "issue", orderId: "order", type: "RETURN", status: "PENDING" }),
      updateMany: async (args: { data: Record<string, unknown> }) => { writes.push({ model: "issue", data: args.data }); return { count: 1 }; },
    },
    orderLifecycleEvent: { create: async (args: { data: Record<string, unknown> }) => { writes.push({ model: "event", data: args.data }); return { createdAt: new Date("2026-09-23T00:00:00Z") }; } },
  };
  const db = { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) };
  const result = await decideAdminOrderIssue(db as never, "admin", "issue", { status: "ADMIN_APPROVED", reason: "Reviewed evidence", reference: "CASE-1" });
  assert.equal(result.financialAction, false);
  assert.equal(result.previousStatus, "PENDING");
  assert.equal(writes[0].data.status, "ADMIN_APPROVED");
  assert.equal(writes[1].data.actorId, "admin");
  assert.deepEqual(writes[1].data.metadata, { issueId: "issue", issueType: "RETURN", previousStatus: "PENDING", newStatus: "ADMIN_APPROVED", reason: "Reviewed evidence", reference: "CASE-1", financialAction: false });
  const decisionSource = source("lib/admin-order-issue-decision.ts");
  assert.doesNotMatch(decisionSource, /stripe\.|refundRequest\.|transfer\.|paymentIntent\./);
});

test("admin issue decisions reject cancellation and invalid statuses", async () => {
  const db = { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ orderIssue: { findUnique: async () => ({ id: "issue", orderId: "order", type: "CANCELLATION", status: "PENDING" }) } }) };
  await assert.rejects(decideAdminOrderIssue(db as never, "admin", "issue", { status: "ADMIN_APPROVED", reason: "Evidence" }), (error: unknown) => error instanceof AdminIssueDecisionError && error.code === "ISSUE_NOT_FOUND");
  await assert.rejects(decideAdminOrderIssue(db as never, "admin", "issue", { status: "REFUNDED", reason: "Evidence" }), (error: unknown) => error instanceof AdminIssueDecisionError && error.code === "ISSUE_STATUS_INVALID");
});
