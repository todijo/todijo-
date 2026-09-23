import assert from "node:assert/strict";
import test from "node:test";
import { authorizeSellerPlatformCj, findOwnedSellerSupplierDuplicate } from "../lib/suppliers/seller-platform-cj";

function fixture() {
  const writes: unknown[] = [];
  let permitted = true, platform = true, configured = true, created = false;
  const db: any = {
    store: { findFirst: async ({ where }: any) => where.ownerId === "seller-a" ? { id: "store-a", dropshippingEnabled: permitted } : null },
    supplierConnection: {
      findFirst: async ({ where }: any) => {
        if (where.ownerType === "PLATFORM") return platform ? { id: "platform-cj" } : null;
        return created ? { id: "seller-cj-store-a" } : null;
      },
      upsert: async (input: any) => { writes.push(input); created = true; return { id: input.create.id }; },
    },
  };
  const provider: any = { id: "CJ", isConfigured: () => configured };
  return { db, writes, provider, setPermitted: (value: boolean) => permitted = value,
    setPlatform: (value: boolean) => platform = value,
    setConfigured: (value: boolean) => configured = value };
}

test("seller CJ access fails closed before any logical connection is written", async () => {
  const state = fixture();
  state.setPermitted(false);
  await assert.rejects(() => authorizeSellerPlatformCj(state.db, "seller-a", "store-a", () => state.provider), /DROPSHIPPING_PERMISSION_DENIED/);
  state.setPermitted(true);
  await assert.rejects(() => authorizeSellerPlatformCj(state.db, "seller-a", "store-b", () => state.provider), /DROPSHIPPING_PERMISSION_DENIED/);
  state.setPlatform(false);
  await assert.rejects(() => authorizeSellerPlatformCj(state.db, "seller-a", "store-a", () => state.provider), /SUPPLIER_PLATFORM_UNAVAILABLE/);
  state.setPlatform(true); state.setConfigured(false);
  await assert.rejects(() => authorizeSellerPlatformCj(state.db, "seller-a", "store-a", () => state.provider), /SUPPLIER_PLATFORM_UNAVAILABLE/);
  assert.equal(state.writes.length, 0);
});

test("authorized seller gets an ownership marker, never a credential", async () => {
  const state = fixture();
  const result = await authorizeSellerPlatformCj(state.db, "seller-a", "store-a", () => state.provider);
  assert.equal(result.connectionId, "seller-cj-store-a");
  assert.equal(result.provider, state.provider);
  assert.equal(state.writes.length, 1);
  const create = (state.writes[0] as any).create;
  assert.equal(create.storeId, "store-a");
  assert.equal(create.ownerType, "SELLER");
  assert.equal(create.provider, "CJ");
  assert.equal(create.externalAccountId, undefined);
});

test("seller CJ duplicate lookup spans reconnects but never another store", async () => {
  let where: any;
  const db: any = { supplierProductLink: { findFirst: async (args: any) => {
    where = args.where;
    return { productId: "already-imported" };
  } } };
  assert.deepEqual(await findOwnedSellerSupplierDuplicate(db, "store-a", "cj-p1"), { productId: "already-imported" });
  assert.deepEqual(where, { ownerType: "SELLER", product: { storeId: "store-a", removedAt: null }, supplierProductId: "cj-p1" });
  assert.equal("connectionId" in where, false);
});
