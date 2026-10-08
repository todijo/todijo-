import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerTeamCopy } from "../i18n/seller-team";
import { productUpdatePermissions } from "../lib/seller-product-authorization";
import { requireStoreCapability, resolveSellerStoreContext, SellerCapabilityError } from "../lib/seller-business-access";
import { permissionsForTemplate, teamPermissions, teamRoleTemplates, teamSeatLimit } from "../lib/seller-team-permissions";

const source = (path: string) => readFileSync(path, "utf8");

function accessDb(plan="pro",memberStatus="ACTIVE") {
  const stores = [
    { id: "owned", name: "Owned", slug: "owned", businessId: "business-owner", ownerId: "owner" },
    { id: "assigned", name: "Assigned", slug: "assigned", businessId: "business-team", ownerId: "other-owner" },
    { id: "foreign", name: "Foreign", slug: "foreign", businessId: "business-foreign", ownerId: "foreign-owner" },
  ];
  const membership = { id: "membership", businessId: "business-team", permissions: ["PRODUCT_VIEW", "ORDER_VIEW"], business: { ownerId: "other-owner",owner:{role:"SELLER"},billingStore:{subscription:{status:"ACTIVE",plan,currentPeriodEnd:new Date("2099-01-01")},accessGrants:[]} }, assignments: [{ storeId: "assigned" }] };
  return {
    store: {
      findUnique: async ({ where }: any) => {const store=stores.find((item)=>item.id===where.id);return store?{...store,business:null,owner:{role:"SELLER"}}:null;},
      findMany: async ({ where }: any) => where.ownerId?stores.filter((store) => store.ownerId === where.ownerId):stores.filter(store=>where.id.in.includes(store.id)),
    },
    sellerBusiness: { findUnique: async () => null },
    sellerTeamMembership: {
      findFirst: async ({ where }: any) => where.userId === "member" && memberStatus === "ACTIVE" && where.businessId === "business-team" && where.status === "ACTIVE" && where.assignments.some.storeId === "assigned" ? membership : null,
      findMany: async ({ where }: any) => where.userId === "member" && memberStatus === "ACTIVE" ? [membership] : [],
    },
    sellerTeamStoreAssignment: { findMany: async ({ where }: any) => where.membership.userId === "member" ? [{ createdAt: new Date(), store: stores[1] }] : [] },
  } as any;
}

test("role templates expose bounded explicit capabilities and owner plus three seats remains canonical", () => {
  assert.equal(teamSeatLimit, 3);
  assert.deepEqual(teamRoleTemplates, ["STORE_MANAGER", "ORDER_MANAGER", "PRODUCT_MANAGER", "CUSTOMER_SUPPORT", "CUSTOM"]);
  assert.ok(permissionsForTemplate("STORE_MANAGER").includes("STORE_EDIT_SETTINGS"));
  assert.ok(permissionsForTemplate("ORDER_MANAGER").includes("ORDER_FULFILL"));
  assert.ok(permissionsForTemplate("PRODUCT_MANAGER").includes("PRODUCT_CHANGE_PRICE"));
  assert.ok(permissionsForTemplate("CUSTOMER_SUPPORT").includes("MESSAGE_REPLY"));
  assert.deepEqual(permissionsForTemplate("CUSTOM"), []);
  assert.equal(new Set(teamPermissions).size, teamPermissions.length);
});

test("store capability resolution permits owners and exact active assignments only", async () => {
  const db = accessDb();
  assert.equal((await requireStoreCapability(db, "owner", "owned", "PRODUCT_DELETE")).owner, true);
  assert.equal((await requireStoreCapability(db, "member", "assigned", "PRODUCT_VIEW")).membershipId, "membership");
  await assert.rejects(() => requireStoreCapability(db, "member", "assigned", "PRODUCT_DELETE"), (error: unknown) => error instanceof SellerCapabilityError && error.code === "PERMISSION_DENIED");
  await assert.rejects(() => requireStoreCapability(db, "member", "foreign", "PRODUCT_VIEW"), (error: unknown) => error instanceof SellerCapabilityError && error.code === "STORE_ACCESS_DENIED");
  await assert.rejects(() => requireStoreCapability(accessDb("plus"), "member", "assigned", "PRODUCT_VIEW"), (error: unknown) => error instanceof SellerCapabilityError && error.code === "PERMISSION_DENIED");
  await assert.rejects(() => requireStoreCapability(accessDb("pro","SUSPENDED"), "member", "assigned", "PRODUCT_VIEW"), (error: unknown) => error instanceof SellerCapabilityError && error.code === "STORE_ACCESS_DENIED");
});

test("forged store selection is rejected while assigned choices remain store-scoped", async () => {
  const db = accessDb();
  assert.equal((await resolveSellerStoreContext(db, "member", "assigned", "ORDER_VIEW")).selected.id, "assigned");
  await assert.rejects(() => resolveSellerStoreContext(db, "member", "foreign", "ORDER_VIEW"), (error: unknown) => error instanceof SellerCapabilityError && error.code === "STORE_ACCESS_DENIED");
});

test("product field diffs require distinct server-side price stock content media and publish capabilities", () => {
  const current: any = { name:"Name",description:"Description long enough",category:"leaf",condition:"NEUF",status:"DRAFT",price:10,compareAtPrice:null,stock:5,colors:[],sizes:[],images:["https://img.test/a"],media:[],allowPrepurchaseQuestions:true,loyaltyEligible:false,productIdentifier:null,manufacturerName:null,manufacturerContact:null,responsiblePerson:null,safetyInformation:null,complianceInformation:null,shippingOverrideEnabled:false,shippingEnabled:null,shippingMethodName:null,shippingPrice:null,shippingFree:null,shippingFreeThreshold:null,shippingMinDays:null,shippingMaxDays:null,shippingCountries:[],shippingWorldwide:null,shippingPostalCodes:[],shippingCarrier:null };
  const base: any = { name:current.name,description:current.description,category:current.category,condition:current.condition,status:current.status,price:"10",compareAtPrice:"",stock:5,colors:[],sizes:[],images:current.images,video:null,allowPrepurchaseQuestions:true,loyaltyEligible:false,productIdentifier:"",manufacturerName:"",manufacturerContact:"",responsiblePerson:"",safetyInformation:"",complianceInformation:"",shippingOverrideEnabled:false };
  assert.deepEqual(productUpdatePermissions(current, base), []);
  assert.deepEqual(productUpdatePermissions(current, { ...base, price:"12" }), ["PRODUCT_CHANGE_PRICE"]);
  assert.deepEqual(productUpdatePermissions(current, { ...base, stock:2 }), ["PRODUCT_CHANGE_STOCK"]);
  assert.ok(productUpdatePermissions(current, { ...base, name:"Changed" }).includes("PRODUCT_EDIT_CONTENT"));
  assert.ok(productUpdatePermissions(current, { ...base, images:[] }).includes("PRODUCT_REMOVE_MEDIA"));
  assert.ok(productUpdatePermissions(current, { ...base, status:"PUBLISHED" }).includes("PRODUCT_PUBLISH"));
  const variants=source("lib/product-variants.ts");
  assert.match(variants,/variantPermissions\.add\("PRODUCT_CHANGE_PRICE"\)/);
  assert.match(variants,/variantPermissions\.add\("PRODUCT_CHANGE_STOCK"\)/);
  assert.match(variants,/for\(const permission of variantPermissions\)await requireStoreCapability/);
});

test("migration preserves stores and subscriptions while adding indexed tenant boundaries", () => {
  const sql = source("prisma/migrations/20261003010000_add_seller_business_team_multistore/migration.sql");
  assert.match(sql, /INSERT INTO "SellerBusiness"[\s\S]*GROUP BY s\."ownerId"/);
  assert.match(sql, /UPDATE "Store" s SET "businessId" = b\."id"/);
  assert.match(sql, /DROP INDEX "Store_ownerId_key"/);
  assert.match(sql, /CREATE INDEX "Store_ownerId_idx"/);
  assert.match(sql, /SellerTeamMembership_userId_status_idx/);
  assert.match(sql, /SellerSaleRecipientDelivery_orderGroupId_recipientId_key/);
  assert.match(sql, /prevent_seller_business_audit_mutation/);
  assert.doesNotMatch(sql, /DELETE FROM "Store"|UPDATE "SellerSubscription"|UPDATE "OrderGroup"/);
});

test("seat accounting, invitation token rotation, session revocation and PRO checks are server-side", () => {
  const team = source("lib/seller-team.ts");
  assert.match(team, /status: \{ in: \["ACTIVE", "SUSPENDED"\] \}/);
  assert.match(team, /acceptedAt: null, revokedAt: null, expiresAt: \{ gt: now \}/);
  assert.match(team, /generateRawAuthToken\(\)/);
  assert.match(team, /hashAuthToken\(rawToken\)/);
  assert.match(team, /sellerBusinessCapabilityTier[\s\S]*!== "pro"/);
  assert.match(team, /authVersion: \{ increment: 1 \}/);
  assert.match(team, /mobileSession\.updateMany/);
  assert.match(source("lib/seller-business-access.ts"), /hasProTeamEntitlement[\s\S]*PERMISSION_DENIED/);
  assert.match(source("app/api/store/route.ts"), /!ownedBusiness&&teamMembership[\s\S]*OWNER_REQUIRED/);
});

test("financial security boundaries remain owner-only and delegated routes use capabilities", () => {
  for (const path of ["app/api/stripe/connect/account/route.ts","app/api/stripe/connect/status/route.ts","app/api/seller/subscription/checkout/route.ts","app/api/seller/subscription/status/route.ts"]) assert.match(source(path), /requireBusinessOwner/);
  const routes: Array<[string,string]> = [
    ["app/api/products/[id]/route.ts","requireProductPermissions"],
    ["app/api/products/[id]/variants/route.ts","SellerCapabilityError"],
    ["app/api/seller/refund-requests/[requestId]/route.ts","REFUND_DECIDE"],
    ["app/api/conversations/[id]/messages/route.ts","sendConversationMessage"],
  ];
  for (const [path, guard] of routes) assert.match(source(path), new RegExp(guard));
});

test("team invitation, management, audit and store switcher UI are real and accessible", () => {
  const team = source("app/seller/team/TeamManagement.tsx");
  assert.match(team, /saveMember/);
  assert.match(team, /invitationAction/);
  assert.match(team, /confirm\(confirmation\)/);
  assert.match(team, /role="alert"/);
  assert.match(source("components/SellerStoreSwitcher.tsx"), /aria-label=\{storeLabel\}/);
  assert.match(source("app/seller/audit/page.tsx"), /skip:\(page-1\)\*take,take/);
});

test("seller team copy resolves every canonical locale and RTL invitation layout is explicit", () => {
  for (const locale of locales) for (const value of Object.values(sellerTeamCopy(locale))) assert.ok(value.trim(), locale);
  assert.match(source("app/team-invitation/page.tsx"), /\["ar","fa","ku"\]\.includes\(locale\)\?"rtl":"ltr"/);
  assert.match(source("app/globals.css"), /@media\(max-width:800px\)\{\.sellerTeamGrid\{grid-template-columns:1fr/);
});

test("All Stores aggregation is restricted to the owner business and team selections are validated", () => {
  const dashboard = source("app/dashboard/page.tsx");
  assert.match(dashboard, /ownedStoreChoices=principal\?\.owner\?storeChoices\.filter\(store=>store\.businessId===principal\.businessId\):\[\]/);
  assert.match(dashboard, /requestedStore&&requestedStore!=="all"&&!storeChoices\.some/);
  assert.match(dashboard, /const ids=ownedStoreChoices\.map/);
});

test("team sale delivery is recipient-idempotent and rechecks access before sending", () => {
  const notifications = source("lib/seller-sale-notifications.ts");
  assert.match(notifications, /permissions:\{has:"ORDER_VIEW"\}/);
  assert.match(notifications, /sellerSaleRecipientDelivery\.create/);
  assert.match(notifications, /ACCESS_REVOKED/);
  assert.match(notifications, /requireStoreCapability\(db,delivery\.recipientId,delivery\.orderGroup\.storeId,"ORDER_VIEW"\)/);
});
