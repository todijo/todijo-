import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { requireProProductImport } from "../lib/pro-product-import";
import { sellerFreeModelCopy } from "../i18n/seller-free-model";
import { dropshippingAccessMessages } from "../i18n/dropshipping-access";

function source(path: string) { return readFileSync(path, "utf8"); }

function importDb(plan: string | null, role = "SELLER", grantPlan: string | null = null) {
  return {
    user: { findUnique: async () => ({ sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null }) },
    sellerBusiness: { findUnique: async ({ where }: { where: Record<string, string> }) => where.ownerId
      ? { id: "business", ownerId: "seller", stores: [{ id: "store" }] }
      : { owner: { role }, billingStore: { subscription: plan ? { status: "ACTIVE", plan, currentPeriodEnd: new Date("2099-01-01") } : null, accessGrants: grantPlan ? [{ source: "ADMIN_GRANTED", plan: grantPlan, startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01") }] : [] } } },
    sellerTeamMembership: { findMany: async () => [] },
  } as never;
}

test("PRO product import is denied for FREE and PLUS and allowed for paid, granted and exempt PRO", async () => {
  for (const plan of ["free", "plus"]) {
    await assert.rejects(() => requireProProductImport(importDb(plan), "seller"), (error: unknown) => error instanceof Error && error.message === "PRO_PRODUCT_IMPORT_REQUIRED");
  }
  assert.equal((await requireProProductImport(importDb("pro"), "seller")).businessId, "business");
  assert.equal((await requireProProductImport(importDb(null, "SELLER", "pro"), "seller")).businessId, "business");
  assert.equal((await requireProProductImport(importDb(null, "ADMIN"), "seller")).businessId, "business");
});

test("import route fails closed before the unavailable importer response and never calls Admin/CJ APIs", () => {
  const route = source("app/api/seller/products/import/route.ts");
  assert.ok(route.indexOf("isTrustedMutationRequest(request)") < route.indexOf("requireProProductImport(prisma, session.userId)"));
  assert.match(route, /PRO_PRODUCT_IMPORT_NOT_AVAILABLE/);
  assert.doesNotMatch(route, /api\/admin|api\/supplier\/cj|CjCatalogProvider|importSupplierProduct/);
  assert.match(source("app/seller/products/import/page.tsx"), /requireProProductImport\(prisma, session\.userId\)/);
});

test("PRO import appears only in the effective owner navigation and the preview admits the importer is not built", () => {
  const navigation = source("components/SellerDashboardLayout.tsx");
  assert.match(navigation, /ownerTools&&proImportAvailable/);
  assert.match(navigation, /hasProSellerCapabilities\(await sellerBusinessCommercialPlan/);
  assert.match(source("app/dashboard/page.tsx"), /proImportAvailable:Boolean\(selectedPrincipal\?\.owner&&hasProSellerCapabilities\(selectedCommercialPlan\)\)/);
  const copy = sellerFreeModelCopy("fr");
  assert.match(copy.proImport, /plateformes et marketplaces compatibles/);
  assert.match(copy.proImport, /bientôt disponible/);
  assert.match(copy.importIntro, /en préparation/);
  assert.match(copy.suppliesHelp, /^Accès aux fournitures d’expédition Todijo, selon disponibilité et conditions\.$/);
});

test("plan chooser has no checkbox-driven PRO recommendation and marketing copy has no guaranteed outcome claim", () => {
  const chooser = source("app/seller/subscription/SubscriptionPlans.tsx");
  assert.doesNotMatch(chooser, /needsProFeature|proNeeds|type="checkbox"/);
  assert.match(chooser, /recommendedSellerPlan\(productCount\)/);
  assert.match(source("lib/seller-plan-recommendation.ts"), /recommendedSellerPlan\(productCount: number\)/);
  const sell = source("app/sell/page.tsx");
  assert.match(sell, /Commencez gratuitement avec FREE/);
  assert.match(sell, /Acheter sur Todijo ne nécessite jamais d’abonnement vendeur/);
  assert.doesNotMatch(sellerFreeModelCopy("fr").reach, /garanti|garantie/i);
  assert.doesNotMatch(sellerFreeModelCopy("fr").suppliesHelp, /illimit/i);
});

test("FREE and paid onboarding progress show different step-three meanings while paid review remains explicit", () => {
  const form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(form, /sellerIntent \? journeyCopy\.subscription : journeyCopy\.verification/);
  assert.match(form, /sellerIntent \? <>{journeyCopy\.noPaymentYet}<br\/>\{journeyCopy\.nextStripe\}<\/> : journeyCopy\.nextFree/);
  assert.match(source("app/seller/subscription/page.tsx"), /journeyCopy\.subscription/);
});

test("PRO seller products explain when supplier access still needs Todijo approval", () => {
  const products = source("app/seller/products/page.tsx");
  assert.match(products, /dropshippingPro &&/);
  assert.match(products, /store\.dropshippingEnabled \? supplierText\("approvedNotConnected"\) : dropshippingCopy\.proApprovalBlocked/);
  assert.equal(dropshippingAccessMessages.fr.proApprovalBlocked, "Le dropshipping est inclus avec PRO. L’accès fournisseur doit être activé par Todijo avant utilisation.");
  assert.match(source("lib/suppliers/supplier-access.ts"), /!store\.dropshippingEnabled/);
  assert.match(source("lib/suppliers/supplier-access.ts"), /hasProSellerCapabilities\(plan\)/);
});

test("FREE dashboard promotes upgrades and readiness warnings contain no inactive-subscription renewal copy", () => {
  const dashboard = source("app/dashboard/page.tsx");
  assert.match(dashboard, /showReadinessWarning/);
  assert.match(dashboard, /freeCopy\.storeReviewTitle/);
  assert.doesNotMatch(dashboard, /subscriptionInactive|subscriptionInactiveHelp/);
  const card = source("components/FreeSellerStartCard.tsx");
  assert.match(card, /dashboardUpgradeTitle/);
  assert.match(card, /dashboardUpgradeBody/);
  assert.match(card, /dashboardUpgradeCta/);
  assert.match(card, /dashboardProVisibility/);
  assert.match(source("app/seller/products/page.tsx"), /freeCopy\.readinessHelp/);
});
