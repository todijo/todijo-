import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createMobileSession } from "../lib/mobile-session";
import { createCheckout, processStripeEvent } from "../lib/payments";
import type { StripeEvent } from "../lib/stripe";

const origin = "http://127.0.0.1:3001";
const disposable = process.env.DATABASE_URL?.includes("127.0.0.1:55432/todijo_e2e") === true &&
  process.env.NODE_ENV !== "production" &&
  process.env.TODIJO_LOCAL_SELLER_ADMIN_HTTP_E2E === "enabled";

async function request(path: string, token: string, method: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, { method, headers: {
    authorization: `Bearer ${token}`,
    ...(path.startsWith("/api/admin/news") ? { "x-todijo-admin-action": "1" } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

test("disposable HTTP seller and admin mutations enforce roles, ownership, and audited settings",
  { skip: !disposable }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const otherSeller = await db.user.findUniqueOrThrow({ where: { email: "seller-b-muiuzxht@review.local" } });
      const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
      const otherStore = await db.store.findUniqueOrThrow({ where: { ownerId: otherSeller.id } });
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Mutation",
        email: `mutation-${suffix}@review.local`, emailVerified: true } });
      const sellerToken = (await createMobileSession(seller, { platform: "android" })).accessToken;
      const otherSellerToken = (await createMobileSession(otherSeller, { platform: "android" })).accessToken;
      const adminToken = (await createMobileSession(admin, { platform: "android" })).accessToken;
      const buyerToken = (await createMobileSession(buyer, { platform: "android" })).accessToken;

      const ownStore = await request("/api/mobile/seller/store", sellerToken, "GET");
      assert.equal(ownStore.status, 200);
      assert.equal((ownStore.body.store as { name: string }).name, store.name);
      assert.notEqual((await request("/api/mobile/seller/store", buyerToken, "GET")).status, 200);
      const storePatch = { name: otherStore.name, description: `LOCAL REVIEW ${suffix}`,
        contactEmail: otherStore.contactEmail, phone: otherStore.phone, logo: otherStore.logo,
        banner: otherStore.banner, country: otherStore.country, city: otherStore.city,
        currency: otherStore.currency, language: otherStore.language,
        sellerType: otherStore.sellerType, legalBusinessName: otherStore.legalBusinessName,
        businessRegistrationId: otherStore.businessRegistrationId,
        businessAddress: otherStore.businessAddress, businessPostalCode: otherStore.businessPostalCode,
        vatStatus: otherStore.vatStatus, vatNumber: otherStore.vatNumber,
        shippingEnabled: otherStore.shippingEnabled, shippingMethodName: otherStore.shippingMethodName,
        shippingPrice: otherStore.shippingPrice?.toString(), shippingFree: otherStore.shippingFree,
        shippingFreeThreshold: otherStore.shippingFreeThreshold?.toString(),
        shippingMinDays: otherStore.shippingMinDays, shippingMaxDays: otherStore.shippingMaxDays,
        shippingCountries: otherStore.shippingCountries, shippingWorldwide: otherStore.shippingWorldwide,
        shippingPostalCodes: otherStore.shippingPostalCodes, shippingCarrier: otherStore.shippingCarrier };
      const changedStore = await request("/api/store", otherSellerToken, "PATCH", storePatch);
      assert.equal(changedStore.status, 200, JSON.stringify(changedStore.body));
      assert.equal((await db.store.findUniqueOrThrow({ where: { id: otherStore.id } })).description,
        storePatch.description);
      assert.equal((await request("/api/store", otherSellerToken, "PATCH",
        { ...storePatch, description: otherStore.description })).status, 200);
      assert.notEqual((await request("/api/store", buyerToken, "PATCH", storePatch)).status, 200);

      const originalLoyalty = store.loyaltyEnabled;
      const toggle = await request("/api/mobile/seller/loyalty", sellerToken, "PATCH",
        { enabled: !originalLoyalty });
      assert.equal(toggle.status, 200, JSON.stringify(toggle.body));
      assert.equal((await db.store.findUniqueOrThrow({ where: { id: store.id } })).loyaltyEnabled,
        !originalLoyalty);
      assert.notEqual((await request("/api/mobile/seller/loyalty", buyerToken, "PATCH",
        { enabled: true })).status, 200);
      assert.equal((await request("/api/mobile/seller/loyalty", sellerToken, "PATCH",
        { enabled: originalLoyalty })).status, 200);

      const product = await request("/api/products", sellerToken, "POST", {
        name: `LOCAL REVIEW mutation ${suffix}`,
        description: "Disposable seller product mutation walkthrough only.",
        category: "women--outerwear--blazers", condition: "NEW",
        status: "DRAFT", price: "19.00", stock: 3, images: [],
      });
      assert.equal(product.status, 200, JSON.stringify(product.body));
      const productId = (product.body.product as { id: string }).id;
      const update = await request(`/api/products/${productId}`, sellerToken, "PUT", {
        name: `LOCAL REVIEW edited ${suffix}`,
        description: "Disposable seller product edit and stock walkthrough only.",
        category: "women--outerwear--blazers", condition: "NEW",
        status: "DRAFT", price: "21.00", stock: 7, images: [],
      });
      assert.equal(update.status, 200, JSON.stringify(update.body));
      const persisted = await db.product.findUniqueOrThrow({ where: { id: productId } });
      assert.equal(persisted.stock, 7);
      assert.equal(persisted.price.toString(), "21");
      assert.notEqual((await request(`/api/products/${productId}`, buyerToken, "PUT", {
        name: persisted.name, description: persisted.description, category: persisted.category,
        status: "DRAFT", price: "1", stock: 0, images: [],
      })).status, 200);
      assert.equal((await request(`/api/mobile/seller/products/${productId}/loyalty`, sellerToken,
        "PATCH", { eligible: true })).status, 200);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).loyaltyEligible, true);
      const variants = await request(`/api/products/${productId}/variants`, sellerToken, "PUT", {
        options: [{ name: "Color", values: [{ value: "Blue" }, { value: "Red" }] }],
        generate: true,
      });
      assert.equal(variants.status, 200, JSON.stringify(variants.body));
      assert.equal(await db.productVariant.count({ where: { productId } }), 2);
      assert.notEqual((await request(`/api/products/${productId}/variants`, buyerToken, "PUT",
        { options: [{ name: "Color", values: [{ value: "Green" }] }], generate: true })).status, 200);
      for (const path of ["/api/mobile/seller/dashboard", "/api/mobile/seller/orders",
        "/api/mobile/seller/plans", "/api/mobile/seller/payments",
        "/api/mobile/seller/supplier-status", "/api/seller/subscription/status"]) {
        const view = await request(path, sellerToken, "GET");
        assert.equal(view.status, 200, `${path}: ${JSON.stringify(view.body)}`);
      }

      const permissionBefore = otherStore.dropshippingEnabled;
      assert.notEqual((await request(`/api/mobile/admin/stores/${otherStore.id}/dropshipping`,
        sellerToken, "PATCH", { enabled: !permissionBefore })).status, 200);
      const permission = await request(`/api/mobile/admin/stores/${otherStore.id}/dropshipping`,
        adminToken, "PATCH", { enabled: !permissionBefore });
      assert.equal(permission.status, 200, JSON.stringify(permission.body));
      assert.equal((await db.store.findUniqueOrThrow({ where: { id: otherStore.id } })).dropshippingEnabled,
        !permissionBefore);
      assert.equal((await request(`/api/mobile/admin/stores/${otherStore.id}/dropshipping`,
        adminToken, "PATCH", { enabled: permissionBefore })).status, 200);

      const blocked = await request(`/api/mobile/admin/users/${buyer.id}`, adminToken,
        "PATCH", { action: "BLOCK", reason: "Disposable local mutation review only" });
      assert.equal(blocked.status, 200, JSON.stringify(blocked.body));
      assert.ok((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).blockedAt);
      const unblocked = await request(`/api/mobile/admin/users/${buyer.id}`, adminToken,
        "PATCH", { action: "UNBLOCK", reason: "Disposable local mutation review complete" });
      assert.equal(unblocked.status, 200, JSON.stringify(unblocked.body));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).blockedAt, null);
      const suspended = await request(`/api/mobile/admin/users/${otherSeller.id}`,
        adminToken, "PATCH", { action: "SELLER_SUSPEND",
          reason: "Disposable local seller status walkthrough" });
      assert.equal(suspended.status, 200, JSON.stringify(suspended.body));
      assert.ok((await db.user.findUniqueOrThrow({ where: { id: otherSeller.id } })).sellerSuspendedAt);
      const restoredSeller = await request(`/api/mobile/admin/users/${otherSeller.id}`,
        adminToken, "PATCH", { action: "SELLER_RESTORE",
          reason: "Restore disposable seller after review" });
      assert.equal(restoredSeller.status, 200, JSON.stringify(restoredSeller.body));
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: otherSeller.id } })).sellerSuspendedAt,
        null);

      const settings = await request("/api/mobile/admin/loyalty", adminToken, "GET");
      assert.equal(settings.status, 200, JSON.stringify(settings.body));
      const current = settings.body.settings as { rateBps: number; enabled: boolean };
      const changedRate = current.rateBps === 200 ? 201 : 200;
      const changed = await request("/api/mobile/admin/loyalty", adminToken, "PATCH",
        { rateBps: changedRate, reason: "Disposable local rate mutation review only" });
      assert.equal(changed.status, 200, JSON.stringify(changed.body));
      assert.equal((await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } })).rateBps,
        changedRate);
      assert.equal((await request("/api/mobile/admin/loyalty", adminToken, "PATCH",
        { rateBps: current.rateBps, reason: "Restore disposable local rate after review" })).status, 200);
      assert.equal((await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } })).enabled,
        current.enabled);
      assert.equal((await request(`/api/mobile/admin/loyalty/accounting?storeId=${store.id}`,
        adminToken, "GET")).status, 200);
      assert.notEqual((await request(`/api/mobile/admin/loyalty/accounting?storeId=${store.id}`,
        sellerToken, "GET")).status, 200);
    } finally { await db.$disconnect(); }
  });

test("disposable HTTP admin verification, moderation, recall, news, and support are server-audited",
  { skip: !disposable }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
      const otherSeller = await db.user.findUniqueOrThrow({ where: { email: "seller-b-muiuzxht@review.local" } });
      const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
      const otherStore = await db.store.findUniqueOrThrow({ where: { ownerId: otherSeller.id } });
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Safety",
        email: `safety-${suffix}@review.local`, emailVerified: true } });
      const adminToken = (await createMobileSession(admin, { platform: "android" })).accessToken;
      const sellerToken = (await createMobileSession(seller, { platform: "android" })).accessToken;
      const originalReview = otherStore.onboardingStatus;
      const review = await request(`/api/mobile/admin/stores/${otherStore.id}/review`, adminToken,
        "PATCH", { status: "NEEDS_INFORMATION", reason: "Disposable local verification review" });
      assert.equal(review.status, 200, JSON.stringify(review.body));
      assert.equal((await db.store.findUniqueOrThrow({ where: { id: otherStore.id } })).onboardingStatus,
        "NEEDS_INFORMATION");
      assert.notEqual((await request(`/api/mobile/admin/stores/${otherStore.id}/review`,
        sellerToken, "PATCH", { status: "VERIFIED", reason: "forged" })).status, 200);
      if (originalReview !== "NEEDS_INFORMATION") await db.store.update({
        where: { id: otherStore.id }, data: { onboardingStatus: originalReview } });

      const digits = suffix.replace(/\D/g, "").padEnd(12, "0").slice(0, 12);
      const body = digits === "000000000000" ? "123456789012" : digits;
      const checksum = [...body].reverse().reduce((sum, digit, index) =>
        sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
      const gtin = `${body}${(10 - checksum % 10) % 10}`;
      const product = await db.product.create({ data: {
        name: `LOCAL REVIEW safety ${suffix}`, slug: `local-safety-${suffix}`,
        description: "Disposable moderation and recall fixture only.",
        price: "9.00", category: "women--outerwear--blazers", condition: "NEW",
        stock: 1, images: [], storeId: store.id, status: "PUBLISHED",
        productIdentifier: gtin,
      } });
      const report = await db.productReport.create({ data: { productId: product.id,
        reporterId: buyer.id, reason: "UNSAFE", details: "Disposable safety review only" } });
      const moderated = await request(`/api/admin/moderation/product-reports/${report.id}`,
        adminToken, "PATCH", { status: "RESOLVED", action: "UNPUBLISH",
          note: "Disposable local moderation decision" });
      assert.equal(moderated.status, 200, JSON.stringify(moderated.body));
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).status, "DRAFT");
      assert.equal(await db.productModerationEvent.count({ where: { reportId: report.id,
        actorId: admin.id } }), 1);

      const recall = await request("/api/mobile/admin/recalls", adminToken, "POST", {
        productId: product.id, reason: "Disposable local platform recall",
        evidence: "Local test product only", reference: `local-${suffix}` });
      assert.equal(recall.status, 201, JSON.stringify(recall.body));
      const recallId = recall.body.recallId as string;
      assert.equal(await db.productRecallKey.count({ where: { recallId } }), 1);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).deactivationReason,
        "ADMIN");
      assert.notEqual((await request("/api/mobile/admin/recalls", sellerToken, "POST", {
        productId: product.id, reason: "forged" })).status, 201);
      const revoked = await request(`/api/mobile/admin/recalls/${recallId}`, adminToken,
        "PATCH", { action: "revoke", reason: "Disposable local recall review completed" });
      assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
      assert.equal((await db.productRecall.findUniqueOrThrow({ where: { id: recallId } })).status,
        "REVOKED");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).status,
        "DRAFT");

      const news = await request("/api/admin/news", adminToken, "POST", {
        locale: "fr", title: `LOCAL REVIEW ${suffix}`,
        content: "Article de vérification dans la base jetable uniquement.", published: false });
      assert.equal(news.status, 201, JSON.stringify(news.body));
      const articleId = (news.body.article as { id: string }).id;
      assert.equal((await db.newsArticle.findUniqueOrThrow({ where: { id: articleId } })).published,
        false);
      assert.notEqual((await request("/api/admin/news", sellerToken, "POST", {
        locale: "fr", title: "Forged", content: "Unauthorized local article.",
      })).status, 201);

      const support = await db.supportRequest.create({ data: { userId: buyer.id,
        replyEmail: buyer.email, category: "OTHER", locale: "fr",
        subject: "Local test", message: "Disposable local support mutation review only." } });
      const supportDecision = await request(`/api/admin/support-requests/${support.id}`,
        adminToken, "PATCH", { status: "RESOLVED", note: "Disposable local response" });
      assert.equal(supportDecision.status, 200, JSON.stringify(supportDecision.body));
      const persisted = await db.supportRequest.findUniqueOrThrow({ where: { id: support.id } });
      assert.equal(persisted.status, "RESOLVED");
      assert.equal(persisted.reviewedById, admin.id);
    } finally { await db.$disconnect(); }
  });

test("disposable HTTP seller fulfillment/refund and admin issue/CMS mutations preserve financial boundaries",
  { skip: !disposable }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Order",
        email: `order-walk-${suffix}@review.local`, emailVerified: true,
        shippingAddresses: { create: { recipientName: "Local Order", addressLine1: "1 Test Street",
          postalCode: "75001", city: "Paris", country: "FR", isDefault: true } } } });
      const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
      const otherSeller = await db.user.findUniqueOrThrow({ where: { email: "seller-b-muiuzxht@review.local" } });
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
      const sellerToken = (await createMobileSession(seller, { platform: "android" })).accessToken;
      const otherToken = (await createMobileSession(otherSeller, { platform: "android" })).accessToken;
      const adminToken = (await createMobileSession(admin, { platform: "android" })).accessToken;
      const item = await db.product.create({ data: { name: `LOCAL REVIEW order ${suffix}`,
        slug: `local-order-${suffix}`, description: "Disposable order mutation fixture.",
        price: "25.00", category: "women--outerwear--blazers", condition: "NEW",
        stock: 2, images: [], storeId: store.id, status: "PUBLISHED" } });
      const sessionId = `cs_test_order_${suffix}`;
      const checkout = await createCheckout(db, buyer.id, `order-walk-${suffix}`,
        [{ productId: item.id, quantity: 1 }],
        async () => ({ id: sessionId, url: `https://checkout.stripe.test/${suffix}` }),
        "FR", undefined, { buyerCurrency: "EUR", stripeMode: "test",
          retrieveConnectedAccount: async id => ({ id, object: "account" as const,
            details_submitted: true, charges_enabled: true, payouts_enabled: true }) });
      assert.ok(checkout.orderId);
      const paid = await processStripeEvent(db, { id: `evt_order_${suffix}`,
        type: "checkout.session.completed", livemode: false, data: { object: {
          id: sessionId, payment_intent: `pi_test_order_${suffix}`,
          payment_status: "paid", client_reference_id: checkout.orderId,
          metadata: { orderId: checkout.orderId }, currency: "eur",
          amount_subtotal: 2500, amount_total: 2500,
          total_details: { amount_shipping: 0, amount_tax: 0 },
          shipping_details: { address: { country: "FR" } },
        } } } as StripeEvent);
      assert.deepEqual(paid, { paid: true });
      const path = `/api/seller/orders/${checkout.orderId}/fulfillment`;
      assert.notEqual((await request(path, otherToken, "POST", { action: "PAID" })).status, 200);
      const processing = await request(path, sellerToken, "POST", { action: "PAID" });
      assert.equal(processing.status, 200, JSON.stringify(processing.body));
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: checkout.orderId } })).status,
        "PROCESSING");
      const shipping = await request(path, sellerToken, "POST", { action: "PROCESSING",
        trackingCarrier: "La Poste", trackingNumber: `LOCAL${suffix}` });
      assert.equal(shipping.status, 200, JSON.stringify(shipping.body));
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: checkout.orderId } })).status,
        "SHIPPED");
      assert.equal((await request(path, sellerToken, "POST", { action: "PROCESSING",
        trackingCarrier: "La Poste", trackingNumber: `LOCAL${suffix}` })).status, 200);
      const delivered = await request(path, sellerToken, "POST", { action: "SHIPPED" });
      assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: checkout.orderId } })).status,
        "DELIVERED");
      const refund = await db.refundRequest.create({ data: { orderId: checkout.orderId,
        buyerId: buyer.id, reason: "Disposable order refund review", status: "PENDING" } });
      assert.notEqual((await request(`/api/seller/refund-requests/${refund.id}`, otherToken,
        "POST", { decision: "approve", decisionNote: "forged" })).status, 200);
      const refundDecision = await request(`/api/seller/refund-requests/${refund.id}`,
        sellerToken, "POST", { decision: "approve",
          decisionNote: "Disposable seller review only; no financial refund" });
      assert.equal(refundDecision.status, 200, JSON.stringify(refundDecision.body));
      assert.equal((await db.refundRequest.findUniqueOrThrow({ where: { id: refund.id } })).status,
        "SELLER_APPROVED");
      assert.equal(await db.refundOperation.count({ where: { refundRequestId: refund.id } }), 0);

      const issue = await db.orderIssue.create({ data: { orderId: checkout.orderId,
        buyerId: buyer.id, type: "RETURN", reason: "Local return",
        description: "Disposable admin issue state review" } });
      const issueDecision = await request(`/api/mobile/admin/issues/${issue.id}`,
        adminToken, "PATCH", { status: "UNDER_REVIEW",
          reason: "Disposable review, no financial action", reference: `local-${suffix}` });
      assert.equal(issueDecision.status, 200, JSON.stringify(issueDecision.body));
      assert.equal(issueDecision.body.financialAction, false);
      assert.equal(await db.refundOperation.count({ where: { refundRequestId: refund.id } }), 0);
      assert.notEqual((await request(`/api/mobile/admin/issues/${issue.id}`, sellerToken,
        "PATCH", { status: "RESOLVED", reason: "forged" })).status, 200);

      const currentPage = await request("/api/mobile/admin/content/about/fr", adminToken, "GET");
      assert.equal(currentPage.status, 200, JSON.stringify(currentPage.body));
      const version = currentPage.body.version as number;
      const saved = await request("/api/admin/site-content/about/fr", adminToken, "PATCH", {
        expectedVersion: version, title: `LOCAL REVIEW ${suffix}`,
        content: "Contenu de vérification jetable, non publié dans la production.",
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const draft = saved.body.revision as { id: string; status: string };
      assert.equal(draft.status, "DRAFT");
      assert.notEqual((await request("/api/admin/site-content/about/fr", sellerToken, "PATCH", {
        expectedVersion: version + 1, title: "Forged", content: "Unauthorized local draft.",
      })).status, 200);
    } finally { await db.$disconnect(); }
  });

test("disposable HTTP admin global loyalty activation and platform adjustment remain audited and separate",
  { skip: !disposable || process.env.TODIJO_LOCAL_LOYALTY_HTTP_E2E !== "enabled" }, async () => {
    const db = new PrismaClient();
    try {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@review.local" } });
      const verifier = await db.user.findUniqueOrThrow({ where: { email: "admin-verifier@review.local" } });
      const seller = await db.user.findUniqueOrThrow({ where: { email: "seller@review.local" } });
      const store = await db.store.findUniqueOrThrow({ where: { ownerId: seller.id } });
      const buyer = await db.user.create({ data: { firstName: "Local", lastName: "Funding",
        email: `funding-walk-${suffix}@review.local`, emailVerified: true } });
      const adminToken = (await createMobileSession(admin, { platform: "android" })).accessToken;
      const verifierToken = (await createMobileSession(verifier, { platform: "android" })).accessToken;
      const before = await request("/api/mobile/admin/loyalty", adminToken, "GET");
      assert.equal(before.status, 200);
      assert.equal(before.body.activationReady, true);
      const original = before.body.settings as { enabled: boolean };
      assert.equal(original.enabled, true);
      const disabled = await request("/api/mobile/admin/loyalty", adminToken, "PATCH", {
        enabled: false, confirmation: "DISABLE_LOYALTY",
        reason: "Disposable local disable and restore review only" });
      assert.equal(disabled.status, 200, JSON.stringify(disabled.body));
      assert.equal((await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } })).enabled,
        false);
      assert.notEqual((await request("/api/mobile/admin/loyalty", adminToken, "PATCH", {
        enabled: true, confirmation: "ENABLE_LOYALTY",
        reason: "Missing local release authorization" })).status, 200);
      const enabled = await request("/api/mobile/admin/loyalty", adminToken, "PATCH", {
        enabled: true, confirmation: "ENABLE_LOYALTY",
        reason: "Restore disposable local loyalty after walkthrough",
        releaseReference: process.env.LOYALTY_ACTIVATION_RELEASE_REFERENCE });
      assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
      assert.equal((await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } })).enabled,
        true);
      assert.ok(await db.loyaltySettingsChange.findFirst({ where: { adminId: admin.id,
        oldEnabled: false, newEnabled: true } }));

      const reference = `local_http_${suffix}`;
      const credit = await request("/api/mobile/admin/loyalty/adjustments", adminToken, "POST", {
        direction: "CREDIT", confirmation: "PLEDGE_PLATFORM_CREDIT", buyerId: buyer.id,
        storeId: store.id, amountMinor: 300, reference,
        fundingSource: "PLATFORM_ADMIN", reason: "Disposable local platform pledge only",
      });
      assert.equal(credit.status, 200, JSON.stringify(credit.body));
      const grantId = credit.body.grantId as string;
      assert.equal(credit.body.status, "PENDING");
      assert.notEqual((await request("/api/mobile/admin/loyalty/adjustments", adminToken,
        "POST", { direction: "ATTEST_PLATFORM", confirmation: "ATTEST_PLATFORM_FUNDING",
          reference, evidenceReference: `local_journal_${suffix}`,
          note: "Disposable local second-person attestation" })).status, 200);
      const attested = await request("/api/mobile/admin/loyalty/adjustments", verifierToken,
        "POST", { direction: "ATTEST_PLATFORM", confirmation: "ATTEST_PLATFORM_FUNDING",
          reference, evidenceReference: `local_journal_${suffix}`,
          note: "Disposable local second-person attestation" });
      assert.equal(attested.status, 200, JSON.stringify(attested.body));
      assert.equal((await db.loyaltyGrant.findUniqueOrThrow({ where: { id: grantId } })).fundingSource,
        "PLATFORM_ADMIN");
      const accounting = await request(`/api/mobile/admin/loyalty/accounting?storeId=${store.id}&buyerId=${buyer.id}`,
        adminToken, "GET");
      assert.equal(accounting.status, 200, JSON.stringify(accounting.body));
      const reversed = await request("/api/mobile/admin/loyalty/adjustments", adminToken,
        "POST", { direction: "DEBIT", confirmation: "REVOKE_PLATFORM_CREDIT",
          buyerId: buyer.id, storeId: store.id, amountMinor: 300, grantId,
          reference: `local_debit_${suffix}`, fundingSource: "PLATFORM_ADMIN",
          reason: "Disposable local reversal after walkthrough" });
      assert.equal(reversed.status, 200, JSON.stringify(reversed.body));
      assert.equal((await db.loyaltyGrant.findUniqueOrThrow({ where: { id: grantId } })).reversedMinor,
        300);
      assert.equal((await db.loyaltyProgramSettings.findUniqueOrThrow({ where: { id: "global" } })).enabled,
        original.enabled);
    } finally { await db.$disconnect(); }
  });
