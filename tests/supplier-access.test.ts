import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CjAuthService } from "../lib/suppliers/cj-auth";
import { PLATFORM_CJ_CONNECTION_ID, requirePlatformSupplierProduct, requireSellerSupplierAccess, sellerConnectionWhere, setSellerDropshippingPermission, supplierIdentityKey } from "../lib/suppliers/supplier-access";
import { resolveSupplierProvider } from "../lib/suppliers/supplier-provider";
import { assertProductPublicationEligible, assertSupplierPurchasable } from "../lib/suppliers/safety";
import { importSupplierProduct } from "../lib/suppliers/supplier-products";

test("normal sellers cannot see platform CJ tools and supplier costs remain admin-only", () => {
  const root = resolve(__dirname, "../..");
  const seller = readFileSync(resolve(root, "app/seller/products/page.tsx"), "utf8");
  const admin = readFileSync(resolve(root, "app/adm-barewbar-182203/suppliers/page.tsx"), "utf8");
  assert.doesNotMatch(seller, /SupplierProductManager|supplierCost|supplierStock|CJ product ID/);
  assert.match(seller, /dropshippingEnabled/);
  assert.match(admin, /SupplierCatalogWorkspace/);
  assert.match(admin, /requirePlatformSupplierAdmin/);
});

test("supplier mutation routes require database-verified platform admin access", () => {
  const root = resolve(__dirname, "../..");
  for (const file of ["app/api/supplier/cj/import/route.ts", "app/api/supplier/cj/status/route.ts", "app/api/supplier/products/[id]/sync/route.ts", "app/api/supplier/products/[id]/acknowledge-price/route.ts"]) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.match(source, /requirePlatformSupplierAdmin/);
    assert.doesNotMatch(source, /\["SELLER"\s*,\s*"ADMIN"\]/);
  }
});

test("only an admin can grant or revoke seller dropshipping permission", async () => {
  const updates: unknown[] = [];
  const db: any = {
    user: { findUnique: async ({ where }: any) => ({ id: where.id, role: where.id === "admin" ? "ADMIN" : "SELLER" }) },
    store: { findFirst: async ({ where }: any) => where.id === "store-a" ? { id: "store-a" } : null, update: async (args: any) => { updates.push(args); } },
    supplierConnection: { updateMany: async (args: any) => { updates.push(args); } },
  };
  await assert.rejects(() => setSellerDropshippingPermission(db, { userId: "seller" }, "store-a", true), /Administrator access required/);
  assert.deepEqual(await setSellerDropshippingPermission(db, { userId: "admin" }, "store-a", true), { storeId: "store-a", dropshippingEnabled: true });
  await setSellerDropshippingPermission(db, { userId: "admin" }, "store-a", false);
  assert.equal((updates[2] as any).where.storeId, "store-a");
  assert.equal((updates[2] as any).data.status, "REVOKED");
});

test("seller permission and connection lookup are scoped by authenticated store", async () => {
  const db: any = { store: { findFirst: async ({ where }: any) => where.ownerId === "seller-a" && where.owner.sellerSuspendedAt === null && where.owner.deactivatedAt === null ? { id: "store-a", dropshippingEnabled: true } : { id: "store-b", dropshippingEnabled: false } } };
  assert.equal((await requireSellerSupplierAccess(db, { userId: "seller-a" })).id, "store-a");
  await assert.rejects(() => requireSellerSupplierAccess(db, { userId: "seller-b" }), /DROPSHIPPING_PERMISSION_DENIED/);
  assert.deepEqual(sellerConnectionWhere("store-a", "connection-a"), { id: "connection-a", ownerType: "SELLER", storeId: "store-a" });
});

test("ID guessing cannot cross platform or seller supplier ownership", async () => {
  let where: any;
  const db: any = { product: { findFirst: async (args: any) => { where = args.where; return null; } } };
  await assert.rejects(() => requirePlatformSupplierProduct(db, "seller-b-product"), /SUPPLIER_LINK_NOT_FOUND/);
  assert.deepEqual(where, { id: "seller-b-product", supplierLink: { is: { ownerType: "PLATFORM", connectionId: PLATFORM_CJ_CONNECTION_ID } } });
});

test("seller connection failures never fall back to platform or another tenant", async () => {
  const queries: any[] = [];
  const db: any = { supplierConnection: { findFirst: async ({ where }: any) => { queries.push(where); return { id: where.id }; } } };
  const results = await Promise.allSettled([
    resolveSupplierProvider(db, { ownerType: "SELLER", provider: "CJ", storeId: "store-a", connectionId: "connection-a" }),
    resolveSupplierProvider(db, { ownerType: "SELLER", provider: "CJ", storeId: "store-b", connectionId: "connection-b" }),
  ]);
  assert.equal(results.every((result) => result.status === "rejected" && result.reason.message === "SELLER_SUPPLIER_AUTH_NOT_CONNECTED"), true);
  assert.equal(queries[0].storeId, "store-a"); assert.equal(queries[1].storeId, "store-b");
  assert.notEqual(queries[0].id, queries[1].id);
});

test("concurrent token caches remain instance-scoped", async () => {
  const requests: string[] = [];
  const make = (key: string, token: string) => new CjAuthService({ apiKey: key, fetcher: async (_input, init) => { requests.push(String(init?.body)); return new Response(JSON.stringify({ result: true, success: true, data: { accessToken: token, accessTokenExpiryDate: "2030-01-01T00:00:00Z", refreshToken: `${token}-refresh`, refreshTokenExpiryDate: "2030-02-01T00:00:00Z" } })); } });
  const [a, b] = await Promise.all([make("key-a", "token-a").getAccessToken(), make("key-b", "token-b").getAccessToken()]);
  assert.deepEqual([a, b], ["token-a", "token-b"]);
  assert.match(requests[0], /key-a/); assert.match(requests[1], /key-b/);
});

test("checkout preflight fails closed for disconnected, revoked, or disabled seller connections", () => {
  const base = { supplierAvailable: true, syncStatus: "HEALTHY", ownerType: "SELLER" };
  for (const link of [
    { ...base, connection: null },
    { ...base, connection: { status: "REVOKED", store: { dropshippingEnabled: true } } },
    { ...base, connection: { status: "CONNECTED", store: { dropshippingEnabled: false } } },
  ]) assert.throws(() => assertSupplierPurchasable({ supplierLink: link }), /SUPPLIER_PRODUCT_REQUIRES_REVIEW/);
  assert.doesNotThrow(() => assertSupplierPurchasable({ supplierLink: { ...base, connection: { status: "CONNECTED", store: { dropshippingEnabled: true } } } }));
  assert.doesNotThrow(() => assertSupplierPurchasable({ supplierLink: null }));
});

test("publication accepts a healthy exact CJ mapping and leaves normal marketplace products unchanged", () => {
  const supplierLink = { provider: "CJ", ownerType: "PLATFORM", connectionId: PLATFORM_CJ_CONNECTION_ID, supplierProductId: "PID", supplierAvailable: true, syncStatus: "HEALTHY", connection: { id: PLATFORM_CJ_CONNECTION_ID, status: "CONNECTED", store: null } };
  assert.doesNotThrow(() => assertProductPublicationEligible({ deactivationReason: "SELLER", supplierLink, variants: [{ active: true, supplierConnectionId: PLATFORM_CJ_CONNECTION_ID, supplierVariantId: "VID", supplierAvailable: true }] }));
  assert.doesNotThrow(() => assertProductPublicationEligible({ deactivationReason: "SELLER", supplierLink: null }));
});

test("supplier metadata alone cannot publish through an unhealthy or inexact connection", () => {
  const base = { provider: "CJ", ownerType: "PLATFORM", connectionId: PLATFORM_CJ_CONNECTION_ID, supplierProductId: "PID", supplierAvailable: true, syncStatus: "HEALTHY", connection: { id: PLATFORM_CJ_CONNECTION_ID, status: "CONNECTED", store: null } };
  for (const supplierLink of [
    { ...base, supplierAvailable: false },
    { ...base, syncStatus: "ERROR" },
    { ...base, connection: { ...base.connection, status: "REVOKED" } },
    { ...base, connection: { ...base.connection, id: "another-connection" } },
    { ...base, connectionId: "seller-cj", connection: { id: "seller-cj", status: "CONNECTED", store: null } },
    { ...base, supplierProductId: "" },
  ]) assert.throws(() => assertProductPublicationEligible({ deactivationReason: "SELLER", supplierLink }), /SUPPLIER_PRODUCT_REQUIRES_REVIEW/);
});

test("publication requires one exact available supplier variant and respects admin moderation blocks", () => {
  const supplierLink = { provider: "CJ", ownerType: "PLATFORM", connectionId: PLATFORM_CJ_CONNECTION_ID, supplierProductId: "PID", supplierAvailable: true, syncStatus: "HEALTHY", connection: { id: PLATFORM_CJ_CONNECTION_ID, status: "CONNECTED", store: null } };
  assert.throws(() => assertProductPublicationEligible({ deactivationReason: "SELLER", supplierLink, variants: [{ active: true, supplierConnectionId: "wrong", supplierVariantId: "VID", supplierAvailable: true }] }), /SUPPLIER_PRODUCT_REQUIRES_REVIEW/);
  assert.throws(() => assertProductPublicationEligible({ deactivationReason: "ADMIN", supplierLink, variants: [{ active: true, supplierConnectionId: PLATFORM_CJ_CONNECTION_ID, supplierVariantId: "VID", supplierAvailable: true }] }), /PRODUCT_ADMIN_BLOCKED/);
});

test("product update publication remains owner-authorized and server validated", () => {
  const source = readFileSync(resolve(__dirname, "../../app/api/products/[id]/route.ts"), "utf8");
  assert.match(source, /store:\s*\{ ownerId: session\.userId \}/);
  assert.match(source, /status === "PUBLISHED"[\s\S]+requirePublishingAccess[\s\S]+assertProductPublicationEligible/);
  assert.match(source, /COMPLIANCE_DECLARATION_REQUIRED/);
  assert.doesNotMatch(source, /request[^\n]+update\([^\n]+status/);
});

test("tenant migration is additive, defaults sellers off, and preserves existing links as platform-owned", () => {
  const sql = readFileSync(resolve(__dirname, "../../prisma/migrations/20260811160000_add_supplier_tenant_isolation/migration.sql"), "utf8");
  assert.match(sql, /dropshippingEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ownerType" "SupplierOwnerType" NOT NULL DEFAULT 'PLATFORM'/);
  assert.match(sql, /connectionId" TEXT/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM)\b/i);
});

test("supplier product and variant identity permits the same IDs across platform and seller connections", () => {
  const connections = [PLATFORM_CJ_CONNECTION_ID, "seller-a-cj", "seller-b-cj"];
  const productKeys = connections.map((connectionId) => supplierIdentityKey(connectionId, "ABC"));
  const variantKeys = connections.map((connectionId) => supplierIdentityKey(connectionId, "V1"));
  assert.equal(new Set(productKeys).size, 3);
  assert.equal(new Set(variantKeys).size, 3);
  assert.equal(new Set([productKeys[1], supplierIdentityKey("seller-a-cj", "ABC")]).size, 1);
  assert.equal(new Set([variantKeys[1], supplierIdentityKey("seller-a-cj", "V1")]).size, 1);
});

test("import blocks duplicates within one connection but permits platform and two sellers", async () => {
  const links = new Map<string, string>();
  const createdLinks: any[] = [];
  const createdVariants: any[] = [];
  let sequence = 0;
  const tx: any = {
    product: { create: async ({ data }: any) => { const id = `product-${++sequence}`; createdLinks.push(data.supplierLink.create); links.set(supplierIdentityKey(data.supplierLink.create.connectionId, data.supplierLink.create.supplierProductId), id); return { id }; } },
    productOption: { create: async () => ({ id: `option-${sequence}` }) },
    productOptionValue: { create: async () => ({ id: `value-${sequence}` }) },
    productVariant: { create: async ({ data }: any) => { createdVariants.push(data); return { id: `variant-${sequence}` }; } },
    productVariantValue: { create: async () => ({}) },
  };
  const db: any = {
    supplierConnection: { findFirst: async ({ where }: any) => ({ id: where.id }) },
    supplierProductLink: { findUnique: async ({ where }: any) => { const key = supplierIdentityKey(where.connectionId_supplierProductId.connectionId, where.connectionId_supplierProductId.supplierProductId); const productId = links.get(key); return productId ? { productId } : null; } },
    product: { findUnique: async () => null },
    $transaction: async (callback: any) => callback(tx),
  };
  const provider: any = { id: "CJ", isConfigured: () => true, getProduct: async () => ({ provider: "CJ", supplierProductId: "CANONICAL-PID", sku: "CJ-SKU", title: "Product", description: "Description", categoryReference: null, sourceUrl: null, cost: 5, currency: "USD", stock: 2, available: true, weightGrams: null, media: [], rawMetadata: {}, variants: [{ supplierVariantId: "V1", sku: null, title: "Variant", cost: 5, currency: "USD", stock: 2, available: true }] }) };
  const media: any = { copyRemote: async () => { throw new Error("unexpected media copy"); } };
  for (const [connectionId, ownerType, storeId] of [[PLATFORM_CJ_CONNECTION_ID, "PLATFORM", "platform-store"], ["seller-a-cj", "SELLER", "store-a"], ["seller-b-cj", "SELLER", "store-b"]] as const) {
    await importSupplierProduct(db, provider, media, { connectionId, ownerType, storeId, supplierProductId: "ABC", sellingPrice: 20, category: "women--outerwear--blazers" });
  }
  await assert.rejects(() => importSupplierProduct(db, provider, media, { connectionId: "seller-a-cj", ownerType: "SELLER", storeId: "store-a", supplierProductId: "ABC", sellingPrice: 20, category: "women--outerwear--blazers" }), /SUPPLIER_PRODUCT_ALREADY_IMPORTED/);
  assert.deepEqual(createdLinks.map((link) => link.connectionId), [PLATFORM_CJ_CONNECTION_ID, "seller-a-cj", "seller-b-cj"]);
  assert.deepEqual(createdLinks.map((link) => link.supplierProductId), ["CANONICAL-PID", "CANONICAL-PID", "CANONICAL-PID"]);
  assert.deepEqual(createdVariants.map((variant) => variant.supplierConnectionId), [PLATFORM_CJ_CONNECTION_ID, "seller-a-cj", "seller-b-cj"]);
});

test("import rejects a connection whose tenant ownership does not match", async () => {
  let where: any;
  const db: any = { supplierConnection: { findFirst: async (args: any) => { where = args.where; return null; } } };
  const provider: any = { id: "CJ", isConfigured: () => true };
  await assert.rejects(() => importSupplierProduct(db, provider, { copyRemote: async () => { throw new Error("unexpected media copy"); } }, { connectionId: "seller-b-cj", ownerType: "SELLER", storeId: "store-a", supplierProductId: "ABC", sellingPrice: 20, category: "women--outerwear--blazers" }), /SUPPLIER_CONNECTION_NOT_AUTHORIZED/);
  assert.equal(where.id, "seller-b-cj"); assert.equal(where.storeId, "store-a"); assert.equal(where.ownerType, "SELLER");
});

test("supplier import copies and persists at most 30 ordered images", async () => {
  const sourceImages=Array.from({length:35},(_,index)=>({type:"IMAGE" as const,url:`https://supplier.test/${index}.jpg`}));
  const copied:string[]=[];
  let created:any;
  const db:any={
    supplierConnection:{findFirst:async()=>({id:"platform-cj"})},
    supplierProductLink:{findUnique:async()=>null},
    product:{findUnique:async()=>null},
    $transaction:async(callback:any)=>callback({product:{create:async({data}:any)=>{created=data;return{id:"product-1"};}}}),
  };
  const provider:any={id:"CJ",isConfigured:()=>true,getProduct:async()=>({provider:"CJ",supplierProductId:"PID",sku:null,title:"Product",description:"Description",categoryReference:null,sourceUrl:null,cost:1,currency:"USD",stock:1,available:true,weightGrams:null,variants:[],media:sourceImages,rawMetadata:{}})};
  const media:any={copyRemote:async(source:any)=>{copied.push(source.url);return{...source,provider:"CLOUDINARY",publicId:`media-${copied.length}`,width:null,height:null,durationMs:null};}};
  await importSupplierProduct(db,provider,media,{storeId:"store",connectionId:"platform-cj",ownerType:"PLATFORM",supplierProductId:"PID",sellingPrice:10,category:"women--outerwear--blazers"});
  assert.deepEqual(copied,sourceImages.slice(0,30).map((item)=>item.url));
  assert.deepEqual(created.images,copied);
  assert.equal(created.images[0],sourceImages[0].url);
  assert.equal(created.media.create.length,30);
});

test("corrective migration replaces only global supplier identities with tenant-scoped constraints", () => {
  const root = resolve(__dirname, "../..");
  const sql = readFileSync(resolve(root, "prisma/migrations/20260811170000_scope_supplier_identities_by_tenant/migration.sql"), "utf8");
  const products = readFileSync(resolve(root, "lib/suppliers/supplier-products.ts"), "utf8");
  assert.match(sql, /INSERT INTO "SupplierConnection"[\s\S]*'platform-cj'/);
  assert.match(sql, /UPDATE "SupplierProductLink"[\s\S]*"ownerType" = 'PLATFORM'/);
  assert.match(sql, /UPDATE "ProductVariant"[\s\S]*"supplierConnectionId" = 'platform-cj'/);
  assert.match(sql, /DROP INDEX "SupplierProductLink_provider_supplierProductId_key"/);
  assert.match(sql, /DROP INDEX "ProductVariant_supplierProvider_supplierVariantId_key"/);
  assert.match(sql, /UNIQUE INDEX "SupplierProductLink_connectionId_supplierProductId_key"/);
  assert.match(sql, /UNIQUE INDEX "ProductVariant_supplierConnectionId_supplierVariantId_key"/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
  assert.match(products, /connectionId_supplierProductId/);
  assert.match(products, /supplierConnectionId:current\.connectionId/);
  assert.doesNotMatch(products, /provider_supplierProductId/);
});

test("rolling guard maps old-app platform product and variant writes to platform-cj", () => {
  const sql = readFileSync(resolve(__dirname, "../../prisma/migrations/20260811180000_guard_legacy_supplier_connection_scope/migration.sql"), "utf8");
  assert.match(sql, /NEW\."ownerType" = 'PLATFORM' AND NEW\."connectionId" IS NULL/);
  assert.match(sql, /NEW\."connectionId" := 'platform-cj'/);
  assert.match(sql, /WHERE link\."productId" = NEW\."productId"/);
  assert.match(sql, /INTO NEW\."supplierConnectionId"/);
  assert.doesNotMatch(sql, /NEW\."supplierConnectionId" := 'platform-cj'/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
});

test("rolling guard preserves seller and manual isolation while backfilling only exact ownership", () => {
  const sql = readFileSync(resolve(__dirname, "../../prisma/migrations/20260811180000_guard_legacy_supplier_connection_scope/migration.sql"), "utf8");
  assert.match(sql, /WHERE "ownerType" = 'PLATFORM' AND "connectionId" IS NULL/);
  assert.match(sql, /link\."productId" = variant\."productId"/);
  assert.match(sql, /link\."connectionId" IS NOT NULL/);
  assert.match(sql, /variant\."supplierVariantId" IS NOT NULL/);
  assert.doesNotMatch(sql, /"ownerType" = 'SELLER'[\s\S]*'platform-cj'/);
});
