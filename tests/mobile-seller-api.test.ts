import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("mobile seller access derives role and store ownership from the bearer session", () => {
  const context = source("lib/mobile-seller-context.ts");
  assert.match(context, /readMobileSession\(request\)/);
  assert.match(context, /session\.role !== "SELLER"/);
  assert.match(context, /assertSellerActivity\(prisma, session\.userId\)/);
  assert.match(context, /ownerId: session\.userId/);
  assert.doesNotMatch(context, /readSession\(/);
});

test("mobile seller reads reuse web-owned pagination, order, dashboard and subscription rules", () => {
  const products = source("app/api/mobile/seller/products/route.ts");
  const orders = source("app/api/mobile/seller/orders/route.ts");
  const dashboard = source("app/api/mobile/seller/dashboard/route.ts");
  for (const route of [products, orders, dashboard]) {
    assert.match(route, /requireMobileSeller\(request\)/);
    assert.match(route, /private, no-store/);
    assert.doesNotMatch(route, /readSession\(/);
  }
  assert.match(products, /listSellerProducts\(prisma, store\.id, query\)/);
  assert.match(products, /canPublish\(store\)/);
  assert.match(orders, /listSellerOrderHistory\(/);
  assert.match(orders, /sellerFulfillmentActionFor\(/);
  assert.match(orders, /safeCarrierTrackingUrl\(/);
  assert.match(dashboard, /sellerOrderHistoryWhere\(/);
  assert.match(dashboard, /sellerAnalytics\(/);
  assert.match(dashboard, /sellerPeriodMetrics\(/);
  assert.doesNotMatch(dashboard, /subscription: store\.subscription,/);
  assert.match(dashboard, /subscriptionConfirmed: Boolean\(store\.subscription\.stripeSubscriptionId\)/);
});

test("seller bearer adapter fails closed and preserves browser cookie sessions", () => {
  const adapter = source("lib/seller-request-session.ts");
  assert.match(adapter, /request\.headers\.has\("authorization"\)/);
  assert.match(adapter, /readMobileSession\(request\)/);
  assert.match(adapter, /mobile\.role !== "SELLER"/);
  assert.match(adapter, /isOnboarding && mobile\.role === "CUSTOMER"/);
  assert.match(adapter, /catch\s*\{\s*return null;/);
  assert.match(adapter, /return readSession\(\)/);
  assert.match(source("app/api/products/route.ts"), /export async function GET\(request: Request\) \{\s*const session = await readSession\(\)/);
  for (const path of [
    "app/api/products/route.ts",
    "app/api/products/[id]/route.ts",
    "app/api/products/[id]/variants/route.ts",
    "app/api/products/[id]/variant-images/route.ts",
    "app/api/seller/onboarding/route.ts",
    "app/api/seller/orders/[orderId]/fulfillment/route.ts",
    "app/api/seller/refund-requests/[requestId]/route.ts",
    "app/api/seller/subscription/checkout/route.ts",
    "app/api/seller/subscription/status/route.ts",
    "app/api/stripe/connect/account/route.ts",
    "app/api/stripe/connect/status/route.ts",
  ]) {
    assert.match(source(path), /readSellerRequestSession\(request\)/, path);
  }
});

test("mobile seller API does not return Stripe identifiers", () => {
  const dashboard = source("app/api/mobile/seller/dashboard/route.ts");
  const connect = source("app/api/stripe/connect/status/route.ts");
  assert.doesNotMatch(dashboard, /subscription: store\.subscription,/);
  assert.match(connect, /!request\.headers\.has\("authorization"\) \? \{ accountId: account\.id \} : \{\}/);
  for (const route of [connect, source("app/api/stripe/connect/account/route.ts")]) {
    assert.match(route, /request\.headers\.has\("authorization"\)\) await assertSellerActivity\(prisma, session\.userId\)/);
    assert.match(route, /error instanceof AdminAccessError/);
  }
  const plans = source("app/api/mobile/seller/plans/route.ts");
  assert.match(plans, /requireMobileSeller\(request\)/);
  assert.match(plans, /sellerPlans\(\)/);
  assert.match(plans, /plans: sellerPlans\(\)\.map/);
  assert.doesNotMatch(plans, /id, name, price, currency, productLimit, priceId\s*\}\)\)/);
  const store = source("app/api/mobile/seller/store/route.ts");
  assert.match(store, /requireMobileSeller\(request\)/);
  assert.match(store, /where: \{ id: store\.id \}/);
  assert.doesNotMatch(store, /stripeCustomerId|shippingExternalServiceId/);
  assert.match(source("app/api/store/route.ts"), /export async function PATCH\(request: Request\) \{\s*try \{\s*const session = await readSellerRequestSession\(request\)/);
});

test("native seller category and media contracts reuse responsive sources", () => {
  const categories = source("app/api/mobile/seller/categories/route.ts");
  assert.match(categories, /requireMobileSeller\(request\)/);
  assert.match(categories, /DESKTOP_CATEGORY_TAXONOMY\.map/);
  assert.match(categories, /subcategoryId\(category\.id, group\.id, label\)/);
  const media = source("app/api/media/upload/route.ts");
  assert.match(media, /readSellerRequestSession\(request\)/);
  assert.match(media, /requireSellerMediaStore\(prisma, session\.userId\)/);
  assert.match(media, /sellerMediaPublicId\(storeId/);
  assert.doesNotMatch(media, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/);
});

test("seller payment visibility is owned and omits Stripe transfer identifiers", () => {
  const payments = source("app/api/mobile/seller/payments/route.ts");
  assert.match(payments, /requireMobileSeller\(request\)/);
  assert.match(payments, /storeId: store\.id/);
  assert.match(payments, /storeIdSnapshot: store\.id/);
  assert.match(payments, /sellerNetAmountMinor/);
  assert.match(payments, /transferSubmittedAmountMinor/);
  assert.doesNotMatch(payments, /stripeTransferId|stripeConnectedAccountId|transferIdempotencyKey/);
  assert.match(payments, /private, no-store/);
});

test("seller supplier status requires platform readiness but never exposes credentials", () => {
  const status = source("app/api/mobile/seller/supplier-status/route.ts");
  assert.match(status, /requireMobileSeller\(request\)/);
  assert.match(status, /storeId: store\.id, ownerType: "SELLER"/);
  assert.match(status, /PLATFORM_CJ_CONNECTION_ID/);
  assert.match(status, /store\.dropshippingEnabled/);
  assert.doesNotMatch(status, /externalAccountId|apiKey|accessToken/);
});

test("seller CJ facade uses platform credentials only after seller permission and exact ownership", () => {
  const access = source("lib/mobile-seller-cj.ts");
  const policy = source("lib/suppliers/seller-platform-cj.ts");
  const provider = source("lib/suppliers/supplier-provider.ts");
  const route = source("app/api/mobile/seller/cj/route.ts");
  assert.match(access, /requireMobileSeller\(request\)/);
  assert.match(access, /authorizeSellerPlatformCj\(prisma, seller\.userId, seller\.store\.id\)/);
  assert.match(policy, /requireSellerSupplierAccess\(db/);
  assert.match(policy, /PLATFORM_CJ_CONNECTION_ID/);
  assert.match(policy, /ownerType: "SELLER", provider: "CJ", storeId/);
  assert.match(provider, /store: \{ dropshippingEnabled: true \}/);
  assert.match(provider, /ownerType: "PLATFORM", storeId: null/);
  assert.match(route, /requireMobileSellerCj\(request\)/);
  assert.match(route, /importSupplierProduct\(prisma, provider/);
  assert.match(route, /resolveCjFreightAcrossOrigins/);
  assert.match(route, /calculateSupplierVariantPriceWithFreight/);
  assert.match(route, /verifiedFxRate/);
  assert.match(route, /findOwnedSellerSupplierDuplicate\(prisma, store\.id/);
  assert.match(policy, /ownerType: "SELLER", product: \{ storeId, removedAt: null \}/);
  assert.match(route, /connectionId, ownerType: "SELLER"/);
  assert.match(route, /validateTodijoClassification/);
  assert.match(route, /catalogComplianceDecision/);
  assert.doesNotMatch(route, /CJ_API_KEY|CJ_ACCESS_TOKEN|supplierCost|sourceUrl|rawMetadata/);
});

test("quarantined seller CJ imports need explicit admin category review and remain drafts", () => {
  const route = source("app/api/admin/supplier-products/[id]/review-seller-category/route.ts");
  assert.match(route, /assertAdminMutationRequest\(request\)/);
  assert.match(route, /requireAdmin\(prisma, await readAdminRequestSession\(request\)\)/);
  const adminSession = source("lib/admin-request-session.ts");
  assert.match(adminSession, /if \(request\.headers\.has\("authorization"\)\)/);
  assert.match(adminSession, /await requireMobileAdmin\(request\)/);
  assert.match(adminSession, /catch \{ return null; \}/);
  assert.match(route, /validateTodijoClassification/);
  assert.match(route, /ownerType: "SELLER", classificationStatus: "QUARANTINED"/);
  assert.match(route, /classificationStatus: "REVIEWED"/);
  assert.match(route, /status: "DRAFT"/);
  assert.doesNotMatch(route, /status: "PUBLISHED"/);
  const seller = source("app/api/mobile/seller/cj/route.ts");
  assert.match(seller, /catalogComplianceDecision\(snapshot\)/);
  assert.match(seller, /compliance\.status === "QUARANTINED"/);
});

test("native product editing can preserve existing shipping, variant media and video", () => {
  const detail = source("app/api/mobile/seller/products/[id]/route.ts");
  assert.match(detail, /shippingOverrideEnabled: true/);
  assert.match(detail, /variantImages: product\.options\.flatMap/);
  assert.match(detail, /video: product\.media\[0\] \?\? null/);
  assert.match(detail, /left\.optionValue\.option\.position - right\.optionValue\.option\.position/);
  const edit = source("mobile/lib/src/features/seller/seller_product_editor.dart");
  assert.match(edit, /originalProduct\?\['shippingOverrideEnabled'\]/);
  assert.match(edit, /'variantImages': variantImageAssignments/);
  assert.match(edit, /'optionName': option\['name'\]/);
  assert.match(edit, /'primaryUrl': selected\.contains\(variantPrimaryImages\[key\]\)/);
  assert.match(edit, /videoChanged\) 'video': video/);
  assert.match(edit, /await repo\.saveVariants\(widget\.productId!, \{/);
  assert.match(edit, /'sku': variant\['sku'\]/);
  assert.match(edit, /'barcode': variant\['barcode'\]/);
  assert.match(source("app/api/products/[id]/route.ts"), /Object\.hasOwn\(body, "video"\)/);
});

test("seller refund evidence remains owner-scoped and private", () => {
  const route = source("app/api/mobile/seller/refund-evidence/[orderId]/[evidenceId]/route.ts");
  assert.match(route, /requireMobileSeller\(request\)/);
  assert.match(route, /getSellerRefundEvidence\(prisma, userId, orderId, evidenceId\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /nosniff/);
  assert.doesNotMatch(route, /storageKey:\s*evidence\.storageKey/);
});
