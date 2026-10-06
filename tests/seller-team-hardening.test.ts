import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canAccessAssignedProductCategory, normalizeAllowedCategoryIds, normalizeTeamStoreScopes, requireProductCategoryScope } from "../lib/seller-team-product-scope";
import { isSellerReviewSubmissionTransition, pendingSellerReviewWhere, processSellerReviewEmailDelivery } from "../lib/seller-review-alerts";
import { locales } from "../i18n/config";
import { sellerTeamCopy } from "../i18n/seller-team";
import { isTrustedMutationRequest } from "../lib/request-security";
import { CANONICAL_LEAF_CATEGORIES } from "../lib/desktop-category-taxonomy";
import { SellerCapabilityError } from "../lib/seller-business-access";
import { updateSellerTeamMember } from "../lib/seller-team";

test("team product scope is store-assignment-local and category allow-lists fail closed", () => {
  const [bags, jewelry] = CANONICAL_LEAF_CATEGORIES.slice(-2).map((category) => category.id);
  assert.ok(bags && jewelry);
  assert.deepEqual(normalizeAllowedCategoryIds([bags, bags, jewelry]), [bags, jewelry]);
  assert.deepEqual(normalizeAllowedCategoryIds(["not-a-category"]), []);
  assert.equal(canAccessAssignedProductCategory({ owner: true, productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] }, jewelry), true);
  assert.equal(canAccessAssignedProductCategory({ owner: false, productScope: "ALL_PRODUCTS", categoryKeys: [] }, jewelry), true);
  assert.equal(canAccessAssignedProductCategory({ owner: false, productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] }, bags), true);
  assert.equal(canAccessAssignedProductCategory({ owner: false, productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] }, jewelry), false);
  assert.equal(canAccessAssignedProductCategory({ owner: false, productScope: "SELECTED_CATEGORIES", categoryKeys: [] }, bags), false);
  assert.equal(canAccessAssignedProductCategory({ owner: false, productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] }, null), false);
  const normalized = normalizeTeamStoreScopes(["one"], { one: { productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] } });
  assert.deepEqual(normalized.get("one"), { productScope: "SELECTED_CATEGORIES", categoryKeys: [bags] });
  assert.throws(() => normalizeTeamStoreScopes(["one"], { one: { productScope: "SELECTED_CATEGORIES", categoryKeys: [] } }));
  assert.throws(() => normalizeTeamStoreScopes(["one"], { one: { productScope: "SELECTED_CATEGORIES", categoryKeys: ["not-a-category"] } }));
});

test("server authorization permits only the assigned category for a delegated member", async () => {
  const [allowed, denied] = CANONICAL_LEAF_CATEGORIES.slice(0, 2).map((category) => category.id);
  let assignmentReads = 0;
  const db = {
    store: { findUnique: async () => ({ businessId: "business", ownerId: "owner" }) },
    sellerTeamMembership: { findFirst: async () => ({ id: "membership", businessId: "business", permissions: ["PRODUCT_VIEW"], business: { ownerId: "owner", owner: { role: "SELLER" }, billingStore: { subscription: { status: "ACTIVE", plan: "pro", currentPeriodEnd: new Date("2099-01-01") }, accessGrants: [] } }, assignments: [{ storeId: "store" }] }) },
    sellerTeamStoreAssignment: { findUnique: async () => { assignmentReads++; return { productScope: "SELECTED_CATEGORIES", categoryKeys: [allowed] }; } },
  } as any;
  assert.equal((await requireProductCategoryScope(db, "member", "store", "PRODUCT_VIEW", allowed)).membershipId, "membership");
  await assert.rejects(() => requireProductCategoryScope(db, "member", "store", "PRODUCT_VIEW", denied), (error: unknown) => error instanceof SellerCapabilityError && error.code === "PERMISSION_DENIED");
  await assert.rejects(() => requireProductCategoryScope(db, "member", "store", "PRODUCT_VIEW", null), (error: unknown) => error instanceof SellerCapabilityError && error.code === "PERMISSION_DENIED");
  assert.equal(assignmentReads, 3);
});

test("seller review email is queued only on a genuine transition into pending review", () => {
  assert.equal(isSellerReviewSubmissionTransition("NEEDS_INFORMATION", "PENDING_REVIEW"), true);
  assert.equal(isSellerReviewSubmissionTransition("IN_PROGRESS", "PENDING_REVIEW"), true);
  assert.equal(isSellerReviewSubmissionTransition("PENDING_REVIEW", "PENDING_REVIEW"), false);
  assert.equal(isSellerReviewSubmissionTransition("VERIFIED", "PENDING_REVIEW"), true);
  assert.equal(isSellerReviewSubmissionTransition("PENDING_REVIEW", "NEEDS_INFORMATION"), false);
  assert.deepEqual(pendingSellerReviewWhere(), { status: "PENDING", onboardingStatus: "PENDING_REVIEW", onboardingStep: { gte: 4 }, businessId: { not: null }, owner: { role: "SELLER", emailVerified: true } });
});

test("seller review outbox is claim-once, uses the configured recipient, and degrades safely", async () => {
  const originalRecipient = process.env.ADMIN_REVIEW_EMAIL;
  const originalWarn = console.warn;
  const warnings: string[] = [];
  try {
    delete process.env.ADMIN_REVIEW_EMAIL;
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
    const skippedCalls: any[] = [];
    const skipped = await processSellerReviewEmailDelivery({ sellerReviewEmailDelivery: { updateMany: async (args: any) => { skippedCalls.push(args); return { count: 1 }; } } } as any, "delivery-a", async () => { throw new Error("must not send"); });
    assert.equal(skipped.outcome, "SKIPPED");
    assert.equal(skippedCalls[0].data.status, "SKIPPED");
    assert.ok(warnings.every((warning) => !warning.includes("operations@example.test")));

    process.env.ADMIN_REVIEW_EMAIL = "operations@example.test";
    let duplicateSendCount = 0;
    const duplicate = await processSellerReviewEmailDelivery({ sellerReviewEmailDelivery: { updateMany: async () => ({ count: 0 }) } } as any, "delivery-b", async () => { duplicateSendCount++; });
    assert.equal(duplicate.outcome, "NOT_CLAIMED");
    assert.equal(duplicateSendCount, 0);

    const states: string[] = [];
    const sentTo: string[] = [];
    const sent = await processSellerReviewEmailDelivery({ sellerReviewEmailDelivery: { updateMany: async (args: any) => { states.push(args.data.status); return { count: 1 }; } } } as any, "delivery-c", async ({ to }) => { sentTo.push(to); });
    assert.equal(sent.outcome, "SENT");
    assert.deepEqual(states, ["PROCESSING", "SENT"]);
    assert.deepEqual(sentTo, ["operations@example.test"]);

    const failureStates: string[] = [];
    const failed = await processSellerReviewEmailDelivery({ sellerReviewEmailDelivery: { updateMany: async (args: any) => { failureStates.push(args.data.status); return { count: 1 }; } } } as any, "delivery-d", async () => { throw Object.assign(new Error("private address should never appear"), { code: "EAUTH" }); });
    assert.equal(failed.outcome, "FAILED");
    assert.deepEqual(failureStates, ["PROCESSING", "FAILED"]);
    assert.ok(warnings.every((warning) => !warning.includes("private address") && !warning.includes("operations@example.test")));
  } finally {
    console.warn = originalWarn;
    if (originalRecipient === undefined) delete process.env.ADMIN_REVIEW_EMAIL;
    else process.env.ADMIN_REVIEW_EMAIL = originalRecipient;
  }
});

test("seller-team copy includes approved password and category-scope labels in every locale", () => {
  for (const locale of locales) {
    const copy = sellerTeamCopy(locale);
    for (const key of ["setPassword", "replacePassword", "replacePasswordWarning", "productAccess", "allProducts", "selectedCategories", "allowedCategories"]) {
      assert.ok(copy[key as keyof typeof copy]?.trim(), `${locale}.${key}`);
    }
  }
  assert.equal(sellerTeamCopy("fr").setPassword, "Définir un mot de passe");
  assert.equal(sellerTeamCopy("fr").replacePassword, "Remplacer le mot de passe");
  assert.equal(sellerTeamCopy("fr").replacePasswordWarning, "Le remplacement du mot de passe déconnectera immédiatement ce membre de toutes ses sessions.");
  assert.equal(sellerTeamCopy("en").setPassword, "Set password");
  assert.equal(sellerTeamCopy("en").replacePassword, "Replace password");
  assert.equal(sellerTeamCopy("en").replacePasswordWarning, "Replacing the password will immediately sign this member out of all active sessions.");
});

test("team mutation origin policy allows same-origin requests and rejects foreign origins", () => {
  assert.equal(isTrustedMutationRequest(new Request("https://todijo.test/api/seller/team", { headers: { origin: "https://todijo.test" } })), true);
  assert.equal(isTrustedMutationRequest(new Request("https://todijo.test/api/seller/team", { headers: { origin: "https://attacker.test" } })), false);
});

test("owner password replacement hashes securely, revokes sessions and audits no password material", async () => {
  const events: any[] = [];
  const tx = {
    sellerTeamMembership: { findUnique: async () => ({ id: "membership", userId: "member", businessId: "business", status: "ACTIVE", business: { ownerId: "owner" } }) },
    user: { update: async ({ data }: any) => events.push({ type: "user-update", data }) },
    mobileSession: { updateMany: async ({ data }: any) => events.push({ type: "session-revoke", data }) },
    passwordResetToken: { updateMany: async ({ data }: any) => events.push({ type: "reset-revoke", data }) },
    accountSecurityEvent: { create: async ({ data }: any) => events.push({ type: "security-event", data }) },
    sellerBusinessAuditEvent: { create: async ({ data }: any) => events.push({ type: "audit", data }) },
  };
  const db = { $transaction: async (callback: (inner: any) => unknown) => callback(tx) } as any;
  const result = await updateSellerTeamMember(db, { ownerId: "owner", membershipId: "membership", action: "password", newPassword: "owner-selected-password-123" }, new Date("2026-10-06T00:00:00Z"));
  assert.equal(result.passwordChanged, true);
  const userUpdate = events.find((event) => event.type === "user-update").data;
  assert.notEqual(userUpdate.passwordHash, "owner-selected-password-123");
  assert.match(userUpdate.passwordHash, /^\$2/);
  assert.deepEqual(userUpdate.authVersion, { increment: 1 });
  assert.ok(events.some((event) => event.type === "session-revoke"));
  assert.ok(events.some((event) => event.type === "reset-revoke"));
  assert.ok(events.some((event) => event.type === "security-event" && event.data.type === "OWNER_PASSWORD_REPLACED"));
  const audit = events.find((event) => event.type === "audit").data;
  assert.equal(audit.actorId, "owner");
  assert.equal(audit.action, "MEMBER_PASSWORD_REPLACED");
  assert.equal(JSON.stringify(audit).includes("owner-selected-password-123"), false);
  assert.equal(JSON.stringify(audit).includes(userUpdate.passwordHash), false);
});

test("managed-account self-password and reset paths remain server blocked", () => {
  const change = readFileSync("app/api/account/password/route.ts", "utf8");
  assert.match(change, /FOR UPDATE[\s\S]*sellerTeamMembership\.findFirst[\s\S]*\["ACTIVE", "SUSPENDED"\]/);
  const tokens = readFileSync("lib/auth-tokens.ts", "utf8");
  assert.match(tokens, /function consumePasswordResetToken[\s\S]*FOR UPDATE[\s\S]*sellerTeamMembership\.findFirst[\s\S]*\["ACTIVE", "SUSPENDED"\]/);
});
