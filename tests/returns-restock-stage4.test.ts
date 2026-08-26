import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transitionReturnCase } from "../lib/inventory-restock";

function returnDb(options: { status?: string; quantity?: number; purchased?: number; variantId?: string | null; kind?: string; ownerId?: string; actorRole?: string } = {}) {
  const event: any = { id: "return-1", refundOperationId: "refund-1", orderItemId: "item-1", quantity: options.quantity ?? 1, status: options.status ?? "AWAITING_RETURN", reason: "RETURN_REQUIRED", restoredAt: null, refundOperation: { orderId: "order-1", status: "COMPLETED" }, orderItem: { id: "item-1", quantity: options.purchased ?? 3, variantId: options.variantId === undefined ? "variant-1" : options.variantId, productId: "product-1", orderGroup: { id: "group-1", kind: options.kind ?? "MARKETPLACE", store: { ownerId: options.ownerId ?? "seller-a" } } } };
  let variantStock = 4, productStock = 7; const lifecycle: any[] = [];
  const tx: any = {
    user: { findUnique: async ({ where }: any) => where.id === "admin" ? { role: "ADMIN" } : where.id === "buyer" ? { role: "CUSTOMER" } : { role: options.actorRole ?? "SELLER" } },
    inventoryRestockEvent: {
      findUnique: async () => ({ ...event }), findUniqueOrThrow: async () => ({ ...event }),
      updateMany: async ({ where, data }: any) => { if (!where.status.in.includes(event.status)) return { count: 0 }; Object.assign(event, data); return { count: 1 }; },
      update: async ({ data }: any) => { Object.assign(event, data); return event; },
      aggregate: async () => ({ _sum: { quantity: 0 } }),
    },
    productVariant: { findUniqueOrThrow: async () => ({ stock: variantStock, productId: "product-1" }), update: async ({ data }: any) => { variantStock += data.stock.increment; } },
    product: { findUniqueOrThrow: async () => ({ stock: productStock }), update: async ({ data }: any) => { productStock += data.stock.increment; } },
    orderLifecycleEvent: { create: async ({ data }: any) => { lifecycle.push(data); } },
  };
  const db: any = { $transaction: async (run: any) => run(tx) };
  return { db, event, lifecycle, variantStock: () => variantStock, productStock: () => productStock };
}

test("refund without return and CJ return records never mutate marketplace inventory", async () => {
  for (const state of [returnDb({ status: "NOT_APPLICABLE" }), returnDb({ kind: "CJ_PLATFORM" })]) {
    if (state.event.status === "NOT_APPLICABLE") assert.equal((await transitionReturnCase(state.db, "seller-a", "return-1", "restock") as any).status, "NOT_APPLICABLE");
    else await assert.rejects(() => transitionReturnCase(state.db, "seller-a", "return-1", "receive"), /RETURN_NOT_FOUND/);
    assert.equal(state.variantStock(), 4);
  }
});

test("required return receipt and inspection do not change stock until explicit restock", async () => {
  const state = returnDb();
  await transitionReturnCase(state.db, "seller-a", "return-1", "tracking", { carrier: "La Poste", trackingNumber: "TRACK-1" });
  assert.equal(state.event.status, "AWAITING_RETURN"); assert.equal(state.variantStock(), 4);
  await transitionReturnCase(state.db, "seller-a", "return-1", "receive");
  assert.equal(state.event.status, "INSPECTION_REQUIRED"); assert.ok(state.event.receivedAt); assert.equal(state.variantStock(), 4);
  await transitionReturnCase(state.db, "seller-a", "return-1", "restockable", { reason: "Sealed and complete" });
  assert.equal(state.event.status, "RESTOCKABLE"); assert.equal(state.variantStock(), 4);
  await transitionReturnCase(state.db, "seller-a", "return-1", "restock");
  assert.equal(state.event.status, "RESTOCKED"); assert.equal(state.variantStock(), 5); assert.deepEqual([state.event.inventoryBefore, state.event.inventoryAfter], [4, 5]);
});

test("non-restockable inspection preserves inventory", async () => {
  const state = returnDb({ status: "INSPECTION_REQUIRED" });
  await transitionReturnCase(state.db, "admin", "return-1", "non_restockable", { reason: "Damaged and unsafe" });
  assert.equal(state.event.status, "NON_RESTOCKABLE"); assert.equal(state.variantStock(), 4);
});

test("partial variant and non-variant returns restore only the approved quantity once", async () => {
  for (const variantId of ["variant-1", null]) {
    const state = returnDb({ status: "RESTOCKABLE", quantity: 1, purchased: 3, variantId });
    const [a, b] = await Promise.all([transitionReturnCase(state.db, "seller-a", "return-1", "restock"), transitionReturnCase(state.db, "seller-a", "return-1", "restock")]);
    assert.equal((a as any).status, "RESTOCKED"); assert.equal((b as any).status, "RESTOCKED");
    assert.equal(variantId ? state.variantStock() : state.productStock(), variantId ? 5 : 8);
  }
});

test("seller ownership and buyer authorization fail closed while admin remains authorized", async () => {
  const foreign = returnDb({ ownerId: "seller-b" });
  await assert.rejects(() => transitionReturnCase(foreign.db, "seller-a", "return-1", "receive"), /RETURN_NOT_FOUND/);
  await assert.rejects(() => transitionReturnCase(foreign.db, "buyer", "return-1", "receive"), /RETURN_NOT_FOUND/);
  await transitionReturnCase(foreign.db, "admin", "return-1", "receive"); assert.equal(foreign.event.status, "INSPECTION_REQUIRED");
});

test("Stage 4 is initialized only from completed refund allocations and adds no historical stock backfill", () => {
  const lifecycle = readFileSync("lib/refund-lifecycle.ts", "utf8"), migration = readFileSync("prisma/migrations/20260827100000_add_return_restock_lifecycle/migration.sql", "utf8");
  assert.match(lifecycle, /returnRequired[\s\S]*AWAITING_RETURN/); assert.match(lifecycle, /CJ_PLATFORM_MANUAL/);
  assert.doesNotMatch(lifecycle, /processTransferReversal.*transitionReturnCase|createStripeRefund.*transitionReturnCase/);
  assert.doesNotMatch(migration, /UPDATE\s+"(?:Product|ProductVariant)"|INSERT INTO "InventoryRestockEvent"/i);
});
