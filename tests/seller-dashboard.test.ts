import test from "node:test";
import assert from "node:assert/strict";
import { comparisonPercent, sellerAnalytics, sellerPeriodMetrics } from "../lib/seller-dashboard";
import { sellerDashboardGate } from "../lib/dashboard";
import { resolveSellerLifecycleStatus } from "../lib/seller-lifecycle-state";
import { sellerStockAlerts } from "../lib/seller-stock-alerts";
import { locales } from "../i18n/config";
import { sellerActionCenterCopy } from "../i18n/seller-action-center";
import { sellerLifecycleCopy } from "../i18n/seller-lifecycle";
import { sellerOrderHistoryWhere } from "../lib/order-history";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const now = new Date("2026-07-22T12:00:00Z");
const order = (daysAgo: number, amount: number, status = "PAID") => ({ status, buyerId: `buyer_${daysAgo}`, createdAt: new Date(now.getTime() - daysAgo * 86400000), paidAt: amount ? new Date() : null, stripePaymentIntentId: amount ? "pi" : null, sellerAmount: amount, items: [{ quantity: 2, product: { id: "p1", name: "Product" } }] });

test("Admin with an incomplete managed store bypasses the seller onboarding redirect while incomplete sellers still redirect", () => {
  const incompleteStore = { onboardingStep: 0, onboardingStatus: "NOT_STARTED" };
  assert.equal(sellerDashboardGate("ADMIN", true, incompleteStore), null);
  assert.equal(sellerDashboardGate("SELLER", true, incompleteStore), "seller-onboarding");
  assert.equal(sellerDashboardGate("SELLER", false, incompleteStore), "verify-email");
  assert.equal(sellerDashboardGate("SELLER", true, { onboardingStep: 4, onboardingStatus: "VERIFIED" }), null);
  assert.equal(sellerDashboardGate("CUSTOMER", false, incompleteStore), null);
});

test("seller lifecycle state resolves from server role, closure, onboarding and billing records", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const completeStore = { onboardingStep: 4, onboardingStatus: "VERIFIED" };
  assert.equal(resolveSellerLifecycleStatus({ role: "CUSTOMER" }), "BUYER");
  assert.equal(resolveSellerLifecycleStatus({ role: "CUSTOMER", sellerSetupDraftExists: true }), "SELLER_SETUP");
  assert.equal(resolveSellerLifecycleStatus({ role: "SELLER", store: { onboardingStep: 1, onboardingStatus: "IN_PROGRESS" } }), "SELLER_SETUP");
  assert.equal(resolveSellerLifecycleStatus({ role: "SELLER", store: completeStore }), "ACTIVE_SELLER");
  assert.equal(resolveSellerLifecycleStatus({ role: "SELLER", store: completeStore, subscription: { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() + 1_000) }, now }), "RENEWAL_CANCELLED");
  assert.equal(resolveSellerLifecycleStatus({ role: "CUSTOMER", sellerClosedAt: now }), "SELLER_CLOSED");
  assert.equal(resolveSellerLifecycleStatus({ role: "SELLER", store: completeStore, reactivationStockReviewRequired: true }), "REACTIVATION_PENDING");
  assert.equal(resolveSellerLifecycleStatus({ role: "ADMIN", store: { onboardingStep: 0, onboardingStatus: "NOT_STARTED" } }), "ADMIN");
  assert.equal(sellerDashboardGate("SELLER", true, { onboardingStep: 0, onboardingStatus: "NOT_STARTED" }, { sellerClosedAt: now }), null);
});

test("seller stock alert counts use only published simple-product and active-variant inventory", async () => {
  const calls: Array<{ kind: string; where: any }> = [];
  const result = await sellerStockAlerts({
    product: { count: async ({ where }: any) => { calls.push({ kind: "product", where }); return where.stock === 0 ? 2 : 3; } },
    productVariant: { count: async ({ where }: any) => { calls.push({ kind: "variant", where }); return where.stock === 0 ? 4 : 5; } },
  } as any, "store-1");
  assert.deepEqual(result, { lowStock: 8, outOfStock: 6 });
  assert.equal(calls.length, 4);
  for (const call of calls) {
    const product = call.kind === "product" ? call.where : call.where.product;
    assert.equal(product.storeId, "store-1");
    assert.equal(product.status, "PUBLISHED");
    assert.equal(product.dataClass, "PRODUCTION");
    assert.equal(product.removedAt, null);
    if (call.kind === "product") assert.deepEqual(product.variants, { none: {} });
    else assert.equal(call.where.active, true);
  }
});

test("seller setup and stock alert copy is available for every supported locale", () => {
  for (const locale of locales) {
    assert.ok(sellerActionCenterCopy(locale).lowStock);
    assert.ok(sellerActionCenterCopy(locale).outOfStock);
    assert.ok(sellerLifecycleCopy(locale).resumeSetup);
  }
  assert.equal(sellerActionCenterCopy("fr").lowStock, "Stock faible");
  assert.equal(sellerActionCenterCopy("en").lowStock, "Low stock");
  assert.equal(sellerActionCenterCopy("fr").outOfStock, "Rupture de stock");
  assert.equal(sellerActionCenterCopy("en").outOfStock, "Out of stock");
  assert.equal(sellerLifecycleCopy("fr").resumeSetup, "Reprendre ma configuration vendeur");
  assert.equal(sellerLifecycleCopy("en").resumeSetup, "Resume seller setup");
});

test("seller period metrics use real current and previous 30 day windows", () => {
  const metrics = sellerPeriodMetrics([order(2, 1200), order(40, 800)], now);
  assert.deepEqual(metrics.current, { orders: 1, revenue: 12, customers: 1 });
  assert.deepEqual(metrics.previous, { orders: 1, revenue: 8, customers: 1 });
  assert.equal(comparisonPercent(metrics.current.revenue, metrics.previous.revenue), 50);
  assert.equal(comparisonPercent(10, 0), null);
});

test("seller analytics aggregate paid product quantities without fake data", () => {
  const analytics = sellerAnalytics([order(2, 1200), order(1, 0, "PENDING")], "en", now);
  assert.equal(analytics.trends.reduce((sum, day) => sum + day.orders, 0), 2);
  assert.deepEqual(analytics.products, [{ name: "Product", quantity: 2 }]);
  assert.equal(analytics.statuses.find((item) => item.status === "PENDING")?.value, 1);
});

test("seller analytics prefer immutable product snapshots", () => {
  const snapshotOrder: any = { ...order(2, 1200), items: [{ quantity: 1, productNameSnapshot: "Purchased name", product: { id: "p1", name: "Current name" } }] };
  assert.deepEqual(sellerAnalytics([snapshotOrder], "en", now).products, [{ name: "Purchased name", quantity: 1 }]);
});

test("seller recent orders prefer snapshots and retain relation fallbacks", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  assert.match(source, /productImageUrlSnapshot\s*\?\?\s*item\?\.product\.images\[0\]/);
  assert.match(source, /productNameSnapshot\s*\?\?\s*item\?\.product\.name/);
  assert.match(source, /recipientName\s*\?\?\s*order\.buyerNameSnapshot\s*\?\?/);
});

test("seller dashboard reuses the strict order ownership filter and retains five recent orders", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  assert.match(source, /const sellerOrdersWhere = sellerOrderHistoryWhere\(userId, storeId, ""\)/);
  assert.match(source, /prisma\.order\.findMany\(\{ where: sellerOrdersWhere,/);
  assert.match(source, /permissions\.orders \? prisma\.order\.findMany\(\{ where: sellerOrdersWhere, take: 5/);
  const branches: any[] = (sellerOrderHistoryWhere("seller_1", "store_1", "") as any).AND[0].OR;
  assert.deepEqual(branches[0], { storeIdSnapshot: "store_1" });
  assert.equal(branches[1].storeIdSnapshot, null);
  assert.equal(branches[1].items.some.product.storeId, "store_1");
  assert.equal(branches[1].items.every.product.storeId, "store_1");
});

test("seller dashboard scope excludes every legacy multi-store order before rendering", () => {
  const branches: any[] = (sellerOrderHistoryWhere("seller_1", "store_1", "") as any).AND[0].OR;
  const legacy = branches[1];
  const allows = (storeIdSnapshot: string | null, itemOwnerIds: string[]) =>
    storeIdSnapshot === branches[0].storeIdSnapshot || (
      storeIdSnapshot === legacy.storeIdSnapshot
      && itemOwnerIds.some((storeId) => storeId === legacy.items.some.product.storeId)
      && itemOwnerIds.every((storeId) => storeId === legacy.items.every.product.storeId)
    );

  assert.equal(allows(null, ["store_1", "store_1"]), true);
  assert.equal(allows(null, ["store_1", "store_2"]), false);
  assert.equal(allows(null, ["store_2", "store_1"]), false);
  assert.equal(allows("store_1", ["store_2"]), true);
  assert.equal(allows("store_2", ["store_1"]), false);
});

test("seller dashboard keeps its primary hero and operational content ahead of secondary benefits", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  const multiStore = source.slice(source.indexOf("if(principal?.owner&&ownedStoreChoices.length>1"), source.indexOf("if (!activeStore)"));
  assert.ok(multiStore.indexOf("sellerOverviewHero") < multiStore.indexOf("premiumStatsGrid"));
  assert.ok(multiStore.indexOf("premiumStatsGrid") < multiStore.indexOf("<DashboardSection"));
  assert.ok(multiStore.indexOf("<DashboardSection") < multiStore.indexOf("<LockedMultiStoreTeaser"));

  const singleStore = source.slice(source.indexOf("const dashboardMetrics = loadSellerDashboardMetrics"));
  const hero = singleStore.indexOf("<section className=\"sellerOverviewHero\">");
  const heroMetrics = singleStore.indexOf("<SellerDashboardHeroMetrics", hero);
  const secondary = singleStore.indexOf("<SellerDashboardSecondarySections", hero);
  const benefits = singleStore.indexOf("sellerBenefitCatalogEnabled", secondary);
  const stripe = singleStore.indexOf("<StripeConnectSection", benefits);
  assert.ok(hero >= 0 && hero < heroMetrics && heroMetrics < secondary);
  assert.ok(secondary > 0 && benefits > secondary && stripe > benefits);
  const secondaryComponent = source.slice(source.indexOf("async function SellerDashboardSecondarySections"), source.indexOf("export default async function DashboardPage"));
  assert.ok(secondaryComponent.indexOf("className=\"premiumStatsGrid\"") < secondaryComponent.indexOf("className=\"premiumDashboardColumns sellerColumns\""));
  assert.ok(secondaryComponent.indexOf("className=\"premiumDashboardColumns sellerColumns\"") < secondaryComponent.indexOf("<FreeSellerStartCard"));
  assert.ok(secondaryComponent.indexOf("<FreeSellerStartCard") < secondaryComponent.indexOf("<LockedMultiStoreTeaser"));
});

test("seller health uses verified dispatch and cash-refund metrics instead of checkout cancellations", () => {
  const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
  const secondary = source.slice(source.indexOf("async function SellerDashboardSecondarySections"), source.indexOf("export default async function DashboardPage"));
  assert.match(secondary, /loadSellerDispatchHealth\(prisma,activeStore\.id,now\)/);
  assert.match(secondary, /dispatchHealth\.lateDispatches/);
  assert.match(secondary, /dispatchHealth\.unknownDispatches/);
  assert.match(secondary, /dispatchHealth\.ordersWithCashRefunds/);
  assert.doesNotMatch(secondary, /cancellationRate|status===\"CANCELLED\"/);
  const helper = readFileSync(join(process.cwd(), "lib", "seller-dispatch-health.ts"), "utf8");
  assert.match(helper, /shipmentVerifiedAt/);
  assert.match(helper, /storeId/);
  assert.match(helper, /refundedCashMerchandiseMinor/);
});

test("seller health labels have exact key and placeholder parity in every supported locale", () => {
  const folder=join(process.cwd(),"messages","seller-dashboard");
  const english=JSON.parse(readFileSync(join(folder,"en.json"),"utf8"));
  for(const locale of locales){
    const translated=JSON.parse(readFileSync(join(folder,`${locale}.json`),"utf8"));
    assert.deepEqual(Object.keys(translated).sort(),Object.keys(english).sort(),`${locale} key parity`);
    assert.ok(translated.lateDispatches,`${locale} late dispatch label`);
    assert.ok(translated.ordersWithRefunds,`${locale} refund label`);
  }
});

test("Admin dashboard hero, summary metrics and management content retain their ordered structure", () => {
  const page = readFileSync(join(process.cwd(), "app", "adm-barewbar-182203", "page.tsx"), "utf8");
  const dashboard = readFileSync(join(process.cwd(), "app", "adm-barewbar-182203", "AdminDashboard.tsx"), "utf8");
  assert.ok(page.indexOf("className=\"adminHero\"") < page.indexOf("<AdminDashboard"));
  assert.ok(dashboard.indexOf("className=\"adminStats\"") < dashboard.indexOf("className=\"adminColumns\""));
  assert.ok(dashboard.indexOf("className=\"adminColumns\"") < dashboard.indexOf("className=\"adminPanel adminTablePanel\""));
});
