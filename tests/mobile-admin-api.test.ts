import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewSellerOnboarding } from "../lib/seller-onboarding-review";
import { sellerEditDeactivationReason } from "../lib/suppliers/safety";

const source = (path: string) => readFileSync(path, "utf8");

test("mobile admin bearer authority is database-verified and cannot fall back to a cookie", () => {
  const context = source("lib/mobile-admin-context.ts");
  assert.match(context, /readMobileSession\(request\)/);
  assert.match(context, /session\.role !== "ADMIN"/);
  assert.match(context, /requireAdmin\(prisma, session\)/);
  assert.doesNotMatch(context, /readSession\(/);
  for (const path of [
    "app/api/mobile/admin/dashboard/route.ts",
    "app/api/mobile/admin/users/route.ts",
    "app/api/mobile/admin/users/[userId]/route.ts",
    "app/api/mobile/admin/stores/route.ts",
    "app/api/mobile/admin/stores/[storeId]/dropshipping/route.ts",
    "app/api/mobile/admin/stores/[storeId]/review/route.ts",
    "app/api/mobile/admin/operations/route.ts",
    "app/api/mobile/admin/products/route.ts",
  ]) {
    assert.match(source(path), /requireMobileAdmin\(request\)/, path);
    assert.doesNotMatch(source(path), /readSession\(/, path);
  }
});

test("native admin navigation is role-gated and reuses private notifications for the same user", () => {
  const app = source("mobile/lib/src/app.dart");
  assert.match(app, /state\.uri\.path\.startsWith\('\/admin'\)/);
  assert.match(app, /auth\?\.session\?\['role'\] != 'ADMIN'/);
  const dashboard = source("mobile/lib/src/features/admin/admin_screens.dart");
  assert.match(dashboard, /context\.push\('\/account\/notifications'\)/);
  const notifications = source("app/api/mobile/notifications/route.ts");
  assert.match(notifications, /userId:session\.userId/);
});

test("admin operations expose only selected evidence after bearer authorization", () => {
  const operations = source("app/api/mobile/admin/operations/route.ts");
  assert.match(operations, /await requireMobileAdmin\(request\)/);
  assert.match(operations, /INVALID_OPERATION_KIND/);
  for (const model of ["orderIssue", "sellerSubscription", "orderGroup", "supplierFulfillment", "supplierCatalogImportJob"]) {
    assert.match(operations, new RegExp(`prisma\\.${model}\\.findMany`));
  }
  assert.doesNotMatch(operations, /\b(?:tokenEncrypted|apiKey|passwordHash):\s*true/);
  const users = source("app/api/mobile/admin/users/route.ts");
  assert.match(users, /const where: Prisma\.UserWhereInput = \{ AND: conditions \}/);
  const products = source("app/api/mobile/admin/products/route.ts");
  assert.match(products, /removedAt: null/);
  assert.match(products, /requireMobileAdmin\(request\)/);
  assert.match(products, /classificationStatus: "QUARANTINED"/);
  const dashboard = source("app/api/mobile/admin/dashboard/route.ts");
  assert.match(dashboard, /groupBy\(\{ by: \["currency"\]/);
  assert.match(dashboard, /grossPaidOrderVolume30dByCurrency/);
});

test("admin mobile mutations reuse the existing authoritative account and dropshipping services", () => {
  const users = source("app/api/mobile/admin/users/[userId]/route.ts");
  assert.match(users, /performAdminUserAction\(/);
  assert.match(users, /adminUserDeletionPreview\(/);
  assert.match(users, /hardDeleteUserAsAdmin\(/);
  assert.match(source("app/api/mobile/admin/stores/[storeId]/dropshipping/route.ts"), /setSellerDropshippingPermission\(/);
  assert.match(source("app/api/mobile/admin/stores/[storeId]/review/route.ts"), /reviewSellerOnboarding\(/);
  assert.match(source("app/api/admin/seller-onboarding/[storeId]/route.ts"), /reviewSellerOnboarding\(/);
  const managedAccess = source("app/api/admin/stores/route.ts");
  assert.match(managedAccess, /readAdminRequestSession\(request\)/);
  assert.match(managedAccess, /extendManagedAccess\(tx, admin\.id, storeIds, months\)/);
  assert.match(managedAccess, /createManagedStore\(tx, admin\.id,/);
  assert.match(source("mobile/lib/src/features/admin/admin_screens.dart"), /createManagedStore\(payload\)/);
  const margin = source("app/api/admin/dropshipping-margin/route.ts");
  assert.match(margin, /readAdminRequestSession\(request\)/);
  assert.match(margin, /updateGlobalDropshippingMargin\(prisma,/);
  assert.match(margin, /assertAdminMutationRequest\(request\)/);
  const importJob = source("app/api/admin/supplier-products/bulk-import/route.ts");
  assert.match(importJob, /requirePlatformSupplierAdmin\(prisma,session\)/);
  assert.match(importJob, /readAdminRequestSession\(request\)/);
  assert.match(importJob, /createCatalogImportJob\(prisma,/);
  const resumeImport = source("app/api/admin/supplier-products/bulk-import/[jobId]/resume/route.ts");
  assert.match(resumeImport, /requirePlatformSupplierAdmin\(prisma,await readAdminRequestSession\(request\)\)/);
  assert.match(resumeImport, /processCatalogImportJob\(prisma,new CjCatalogProvider\(\),jobId,/);
  for (const action of ["cancel", "retry"]) {
    const route = source(`app/api/admin/supplier-products/bulk-import/[jobId]/${action}/route.ts`);
    assert.match(route, /readAdminRequestSession\(request\)/);
    assert.match(route, /requirePlatformSupplierAdmin\(prisma,/);
    assert.match(route, /assertAdminMutationRequest\(request\)/);
  }
  assert.match(source("app/api/admin/supplier-products/bulk-import/[jobId]/route.ts"), /readAdminRequestSession\(request\)/);
  const categoryReview = source("app/api/admin/supplier-products/[id]/review-seller-category/route.ts");
  assert.match(categoryReview, /readAdminRequestSession\(request\)/);
  assert.match(categoryReview, /classificationStatus: "QUARANTINED"/);
  assert.match(categoryReview, /catalogComplianceDecision\(/);
  assert.match(categoryReview, /validateTodijoClassification\(/);
  const staleSync = source("app/api/admin/supplier-products/sync-stale/route.ts");
  assert.match(staleSync, /readAdminRequestSession\(request\)/);
  assert.match(staleSync, /requirePlatformSupplierAdmin\(prisma, session\)/);
  assert.match(staleSync, /syncStalePlatformCjProducts\(/);
  assert.match(staleSync, /assertAdminMutationRequest\(request\)/);
  const catalogSearch = source("app/api/admin/supplier-products/catalog-search/route.ts");
  assert.match(catalogSearch, /readAdminRequestSession\(request\)/);
  assert.match(catalogSearch, /requirePlatformSupplierAdmin\(prisma,/);
  assert.match(catalogSearch, /provider\.searchProducts\(/);
  const adminClient = source("mobile/lib/src/features/admin/admin_repository.dart");
  assert.match(adminClient, /searchCjCatalog\(/);
  assert.match(adminClient, /bulkImportJob\(/);
  assert.match(adminClient, /cancelBulkImport\(/);
  assert.match(adminClient, /retryBulkImport\(/);
  const releaseTransfer = source("app/api/admin/order-groups/[groupId]/transfer-release/route.ts");
  assert.match(releaseTransfer, /readAdminRequestSession\(request\)/);
  assert.match(releaseTransfer, /releaseHighRiskSellerTransfer\(prisma, session, groupId, body\.reason\)/);
  const submit = source("app/api/admin/supplier-fulfillments/[fulfillmentId]/submit-seller/route.ts");
  assert.match(submit, /readAdminRequestSession\(request\)/);
  assert.match(submit, /assertAdminMutationRequest\(request\)/);
  assert.match(submit, /processSupplierFulfillment\(prisma, fulfillmentId, undefined, true\)/);
  for (const action of ["sync", "retry"]) {
    assert.match(source(`app/api/admin/supplier-fulfillments/[fulfillmentId]/${action}/route.ts`), /readAdminRequestSession\(request\)/);
  }
});

test("seller verification review is admin-only, validates status and records the existing security event", async () => {
  const calls: string[] = [];
  const db: any = {
    user: { findUnique: async ({ where }: any) => ({ id: where.id, role: where.id === "admin" ? "ADMIN" : "SELLER" }) },
    store: {
      findUnique: async ({ where }: any) => where.id === "owned-store" ? { ownerId: "seller" } : null,
      update: async ({ data }: any) => { calls.push(`status:${data.onboardingStatus}`); },
    },
    accountSecurityEvent: { create: async ({ data }: any) => { calls.push(`event:${data.userId}:${data.type}`); } },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  await assert.rejects(() => reviewSellerOnboarding(db, { userId: "seller" }, "owned-store", { status: "VERIFIED", reason: "Documents checked" }), /Administrator access required/);
  await assert.rejects(() => reviewSellerOnboarding(db, { userId: "admin" }, "owned-store", { status: "PENDING_REVIEW", reason: "Documents checked" }), /Invalid seller review/);
  await assert.rejects(() => reviewSellerOnboarding(db, { userId: "admin" }, "foreign-store", { status: "VERIFIED", reason: "Documents checked" }), /Store not found/);
  assert.deepEqual(await reviewSellerOnboarding(db, { userId: "admin" }, "owned-store", { status: "VERIFIED", reason: "Documents checked" }), { ok: true, status: "VERIFIED" });
  assert.deepEqual(calls, ["status:VERIFIED", "event:seller:SELLER_REVIEW_VERIFIED_BY_admin"]);
});

test("Safety Gate moderation hold survives seller draft edits and blocks relisting", () => {
  assert.equal(sellerEditDeactivationReason("ADMIN", "DRAFT"), "ADMIN");
  assert.equal(sellerEditDeactivationReason("ADMIN", "PUBLISHED"), "ADMIN");
  assert.equal(sellerEditDeactivationReason("SELLER", "DRAFT"), "SELLER");
  assert.equal(sellerEditDeactivationReason("SELLER", "PUBLISHED"), "NONE");
  const route = source("app/api/products/[id]/route.ts");
  assert.match(route, /assertProductPublicationEligible\(product\)/);
  assert.match(route, /deactivationReason: sellerEditDeactivationReason\(product\.deactivationReason, status\)/);
});
