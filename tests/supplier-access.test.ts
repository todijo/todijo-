import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CjAuthService } from "../lib/suppliers/cj-auth";
import { requirePlatformSupplierProduct, requireSellerSupplierAccess, sellerConnectionWhere, setSellerDropshippingPermission } from "../lib/suppliers/supplier-access";
import { resolveSupplierProvider } from "../lib/suppliers/supplier-provider";
import { assertSupplierPurchasable } from "../lib/suppliers/safety";

test("normal sellers cannot see platform CJ tools and supplier costs remain admin-only", () => {
  const root = resolve(__dirname, "../..");
  const seller = readFileSync(resolve(root, "app/seller/products/page.tsx"), "utf8");
  const admin = readFileSync(resolve(root, "app/adm-barewbar-182203/suppliers/page.tsx"), "utf8");
  assert.doesNotMatch(seller, /SupplierProductManager|supplierCost|supplierStock|CJ product ID/);
  assert.match(seller, /dropshippingEnabled/);
  assert.match(admin, /SupplierProductManager/);
  assert.match(admin, /ownerType:\s*"PLATFORM"/);
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
  const db: any = { store: { findUnique: async ({ where }: any) => where.ownerId === "seller-a" ? { id: "store-a", dropshippingEnabled: true } : { id: "store-b", dropshippingEnabled: false } } };
  assert.equal((await requireSellerSupplierAccess(db, { userId: "seller-a" })).id, "store-a");
  await assert.rejects(() => requireSellerSupplierAccess(db, { userId: "seller-b" }), /DROPSHIPPING_PERMISSION_DENIED/);
  assert.deepEqual(sellerConnectionWhere("store-a", "connection-a"), { id: "connection-a", ownerType: "SELLER", storeId: "store-a" });
});

test("ID guessing cannot cross platform or seller supplier ownership", async () => {
  let where: any;
  const db: any = { product: { findFirst: async (args: any) => { where = args.where; return null; } } };
  await assert.rejects(() => requirePlatformSupplierProduct(db, "seller-b-product"), /SUPPLIER_LINK_NOT_FOUND/);
  assert.deepEqual(where, { id: "seller-b-product", supplierLink: { is: { ownerType: "PLATFORM", connectionId: null } } });
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

test("tenant migration is additive, defaults sellers off, and preserves existing links as platform-owned", () => {
  const sql = readFileSync(resolve(__dirname, "../../prisma/migrations/20260811160000_add_supplier_tenant_isolation/migration.sql"), "utf8");
  assert.match(sql, /dropshippingEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ownerType" "SupplierOwnerType" NOT NULL DEFAULT 'PLATFORM'/);
  assert.match(sql, /connectionId" TEXT/);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE FROM)\b/i);
});
