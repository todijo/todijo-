import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requireSellerBenefitAccess, SellerBenefitError, sellerBenefitAccessAllowed, sellerBenefitItemAvailable, sellerBenefitQuantityFits } from "../lib/seller-benefits";
import { assertAdminMutationRequest } from "../lib/request-security";

const source = (path: string) => readFileSync(path, "utf8");
const now = new Date("2026-10-05T12:00:00Z");

test("benefits catalog is restricted to active PRO sellers with explicit Admin enablement", () => {
  assert.equal(sellerBenefitAccessAllowed("SELLER", "free", true), false);
  assert.equal(sellerBenefitAccessAllowed("SELLER", "plus", true), false);
  assert.equal(sellerBenefitAccessAllowed("SELLER", "pro", false), false);
  assert.equal(sellerBenefitAccessAllowed("ADMIN", "admin-exempt", true), false);
  assert.equal(sellerBenefitAccessAllowed("SELLER", "pro", true), true);
  const service = source("lib/seller-benefits.ts");
  assert.match(service, /sellerBusinessCommercialPlan\(db, principal\.businessId\)/);
  assert.match(service, /requireBusinessOwner\(db, userId\)/);
  assert.match(service, /sellerBenefitAccessAllowed\(owner\.role, plan, access\?\.enabled === true\)/);
  assert.doesNotMatch(service, /input\.plan|body\.plan/);
});

test("the server access service rejects FREE, PLUS, and PRO without Admin enablement", async () => {
  function database(plan: string, enabled: boolean) {
    const db: any = {
      user: { findUnique: async ({ select }: any) => select.role ? { role: "SELLER" } : { sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null } },
      sellerBusiness: { findUnique: async ({ where }: any) => where.ownerId ? { id: "business", ownerId: "seller", stores: [{ id: "store" }] } : { owner: { role: "SELLER" }, billingStore: { id: "store", subscription: plan === "pro" || plan === "plus" ? { status: "ACTIVE", plan, currentPeriodEnd: new Date("2099-01-01") } : null, accessGrants: [] } } },
      sellerTeamMembership: { findMany: async () => [] },
      sellerBenefitAccess: { findUnique: async () => ({ enabled }) },
    };
    return db;
  }
  for (const [plan, enabled] of [["free", true], ["plus", true], ["pro", false]] as const) {
    await assert.rejects(() => requireSellerBenefitAccess(database(plan, enabled), "seller"), SellerBenefitError);
  }
  assert.equal((await requireSellerBenefitAccess(database("pro", true), "seller")).businessId, "business");
});

test("catalog dates and per-store quantity limits are enforced before requests", () => {
  const item = { active: true, availableFrom: new Date("2026-10-01T00:00:00Z"), availableUntil: new Date("2026-11-01T00:00:00Z") };
  assert.equal(sellerBenefitItemAvailable(item, now), true);
  assert.equal(sellerBenefitItemAvailable({ ...item, active: false }, now), false);
  assert.equal(sellerBenefitItemAvailable({ ...item, availableFrom: new Date("2026-10-06T00:00:00Z") }, now), false);
  assert.equal(sellerBenefitItemAvailable({ ...item, availableUntil: now }, now), false);
  assert.equal(sellerBenefitQuantityFits(5, 2, 3), true);
  assert.equal(sellerBenefitQuantityFits(5, 2, 4), false);
  assert.equal(sellerBenefitQuantityFits(5, 5, 1), false);
  assert.equal(sellerBenefitQuantityFits(5, 0, 0), false);
  const service = source("lib/seller-benefits.ts");
  assert.match(service, /lockSellerBusiness\(tx, initial\.businessId\)/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(service, /sellerBenefitQuantityFits\(item\.quantityLimitPerStore/);
});

test("catalog prices and request records are snapshotted and auditable", () => {
  const service = source("lib/seller-benefits.ts"), schema = source("prisma/schema.prisma");
  assert.match(service, /priceTypeSnapshot: item\.priceType/);
  assert.match(service, /unitPriceMinorSnapshot: item\.priceMinor/);
  assert.match(service, /SELLER_BENEFIT_REQUESTED/);
  assert.match(service, /ADMIN_BENEFIT_ACCESS_ENABLED/);
  assert.match(service, /ADMIN_BENEFIT_ITEM_CREATED/);
  assert.match(service, /ADMIN_BENEFIT_REQUEST_/);
  for (const model of ["SellerBenefitAccess", "SellerBenefitCatalogItem", "SellerBenefitRequest", "SellerBenefitAuditEvent"]) assert.match(schema, new RegExp(`model ${model} \\{`));
});

test("Admin mutations require Admin authorization and trusted mutation origin", () => {
  const api = source("app/api/admin/seller-benefits/route.ts"), review = source("app/api/admin/seller-benefits/requests/[requestId]/route.ts");
  assert.match(api, /assertAdminMutationRequest\(request\)/);
  assert.match(api, /requireAdmin\(prisma, await readSession\(\)\)/);
  assert.match(review, /assertAdminMutationRequest\(request\)/);
  assert.match(review, /requireAdmin\(prisma, await readSession\(\)\)/);
  assert.throws(() => assertAdminMutationRequest(new Request("https://todijo.example/api/admin/seller-benefits", { headers: { "x-todijo-admin-action": "1", origin: "https://attacker.example" } })));
});

test("Seller API and page fail closed unless the server-side benefit gate passes", () => {
  const api = source("app/api/seller/benefits/route.ts"), page = source("app/seller/benefits/page.tsx"), component = source("app/seller/benefits/BenefitsCatalog.tsx");
  assert.match(api, /listSellerBenefits\(prisma, session\.userId, storeId\)/);
  assert.match(api, /requestSellerBenefit\(prisma/);
  assert.match(page, /listSellerBenefits\(prisma, session\.userId, storeId\)/);
  assert.match(page, /notFound\(\)/);
  assert.match(component, /name="quantity" type="number"/);
  assert.doesNotMatch(component, /textarea/);
});

test("dashboard exposes the approved card only for PRO with explicit enablement", () => {
  const dashboard = source("app/dashboard/page.tsx");
  assert.ok(dashboard.includes("hasProSellerCapabilities(selectedCommercialPlan)") && dashboard.includes("sellerBenefitAccess.findUnique"));
  assert.match(dashboard, /sellerBenefitCatalogEnabled &&/);
  assert.match(dashboard, /Les cadeaux Todijo pour vous/);
  assert.match(dashboard, /Découvrez les cadeaux et avantages sélectionnés par Todijo pour votre activité\. Les disponibilités, quantités et tarifs sont indiqués pour chaque article\./);
  assert.match(dashboard, /Découvrir mes avantages/);
});

test("approved catalog copy and old free-form entry are handled safely", () => {
  const page = source("app/seller/benefits/page.tsx"), catalog = source("app/seller/benefits/BenefitsCatalog.tsx"), admin = source("app/adm-barewbar-182203/benefits/AdminSellerBenefitsManager.tsx"), oldPage = source("app/seller/shipping-supplies/page.tsx"), oldApi = source("app/api/seller/shipping-supplies/route.ts");
  for (const text of ["Cadeaux et avantages Todijo", "Offert", "Tarif préférentiel", "Indisponible actuellement", "Quantité", "Limite :", "Choisir cet article"]) assert.ok(`${page}${catalog}`.includes(text));
  for (const text of ["Gestion des avantages Todijo PRO", "Activer l’accès au catalogue", "Désactiver l’accès au catalogue", "Ajouter un avantage", "Nom de l’article", "Description", "Tarif", "Quantité disponible", "Début de disponibilité", "Fin de disponibilité", "Article actif"]) assert.ok(admin.includes(text));
  assert.match(oldPage, /seller\/benefits/);
  assert.match(oldApi, /STRUCTURED_CATALOG_REQUIRED/);
  assert.doesNotMatch(oldApi, /requestProShippingSupplies/);
});

test("Issue 9 database migration is additive and contains no destructive statements", () => {
  const migration = source("prisma/migrations/20261005120000_add_seller_benefits_catalog/migration.sql");
  assert.match(migration, /CREATE TABLE "SellerBenefitAccess"/);
  assert.match(migration, /CREATE TABLE "SellerBenefitCatalogItem"/);
  assert.match(migration, /CREATE TABLE "SellerBenefitRequest"/);
  assert.match(migration, /CREATE TABLE "SellerBenefitAuditEvent"/);
  assert.doesNotMatch(migration, /\b(DROP|DELETE FROM|TRUNCATE)\b/i);
});
