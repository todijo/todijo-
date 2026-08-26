import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { allocateRefund } from "../lib/refund-policy";
import { isAuthoritativeStage4Return, restockState } from "../lib/inventory-restock";
import { transferEligibility } from "../lib/seller-maturity";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("Stage 5 composes multi-seller payment, payout, partial refund, and return invariants", () => {
  const paidGroups = [
    { id: "group-a", seller: "seller-a", kind: "MARKETPLACE", itemSubtotalMinor: 4000, shippingMinor: 500, feeMinor: 400, sellerNetMinor: 4100 },
    { id: "group-b", seller: "seller-b", kind: "MARKETPLACE", itemSubtotalMinor: 2000, shippingMinor: 300, feeMinor: 200, sellerNetMinor: 2100 },
    { id: "group-cj", seller: null, kind: "CJ_PLATFORM", itemSubtotalMinor: 1500, shippingMinor: 0, feeMinor: 0, sellerNetMinor: 0 },
  ];
  assert.equal(new Set(paidGroups.map((group) => group.id)).size, 3);
  assert.deepEqual(paidGroups.filter((group) => group.kind === "MARKETPLACE").map((group) => group.seller), ["seller-a", "seller-b"]);
  assert.equal(paidGroups.find((group) => group.kind === "CJ_PLATFORM")?.sellerNetMinor, 0);
  for (const group of paidGroups) assert.equal(group.sellerNetMinor, group.kind === "MARKETPLACE" ? group.itemSubtotalMinor + group.shippingMinor - group.feeMinor : 0);

  const partial = allocateRefund([
    { orderItemId: "item-a", orderGroupId: "group-a", quantity: 4, alreadyRefundedQuantity: 0, unitAmountMinor: 1000, groupItemSubtotalMinor: 4000, groupPlatformFeeMinor: 400 },
    { orderItemId: "item-b", orderGroupId: "group-b", quantity: 1, alreadyRefundedQuantity: 0, unitAmountMinor: 2000, groupItemSubtotalMinor: 2000, groupPlatformFeeMinor: 200 },
  ], [{ orderItemId: "item-a", quantity: 2 }]);
  assert.deepEqual(partial.groups, [{ orderGroupId: "group-a", merchandiseAmountMinor: 2000, commissionReversalMinor: 200, sellerRecoveryMinor: 1800 }]);
  assert.equal(paidGroups[0]!.sellerNetMinor - partial.groups[0]!.sellerRecoveryMinor, 2300);
  assert.equal(paidGroups[1]!.sellerNetMinor, 2100, "Seller B remains isolated");

  const now = new Date("2026-08-26T00:00:00.000Z");
  assert.equal(transferEligibility("STANDARD", now, now).eligible, true);
  assert.equal(transferEligibility("NEW", now, new Date(now.getTime() + 7 * 86_400_000 - 1)).eligible, false);
  assert.equal(transferEligibility("NEW", now, new Date(now.getTime() + 7 * 86_400_000)).eligible, true);
  assert.equal(transferEligibility("HIGH_RISK", now, now).eligible, false);
  assert.deepEqual(restockState({ isSupplierOwned: false, shipmentVerified: true, decision: "RETURN_PENDING" }), { status: "AWAITING_RETURN", restore: false });
  assert.equal(isAuthoritativeStage4Return({ lifecycleKey: "return:refund-a:item-a", refundOperationId: "refund-a", orderItemId: "item-a", refundOperation: { status: "COMPLETED" }, orderItem: { orderGroup: { kind: "MARKETPLACE" } } }), true);
  assert.equal(isAuthoritativeStage4Return({ lifecycleKey: "return:refund-a:item-a", refundOperationId: "refund-a", orderItemId: "item-a", refundOperation: { status: "COMPLETED" }, orderItem: { orderGroup: { kind: "CJ_PLATFORM" } } }), false);
});

test("payment, payout, refund, reversal, and restock duplicate barriers remain connected", () => {
  const payments = read("lib/payments.ts"), transfers = read("lib/seller-transfers.ts"), refunds = read("lib/refund-lifecycle.ts"), restocks = read("lib/inventory-restock.ts");
  assert.match(payments, /stripeWebhookEvent[\s\S]*previouslyProcessed/);
  assert.match(payments, /stock: \{ decrement: item\.quantity \}/);
  assert.doesNotMatch(payments, /processEligibleSellerTransfer|createStripeTransfer/);
  assert.match(transfers, /transferSubmittedAmountMinor[\s\S]*transferIdempotencyKey/);
  assert.match(refunds, /refundIdempotencyKey[\s\S]*seller-reversal:/);
  assert.match(refunds, /originalStripeTransferId: allocation\.orderGroup\.stripeTransferId/);
  assert.match(restocks, /updateMany\(\{ where: \{ id: event\.id, status: \{ in: expected \}/);
  assert.match(restocks, /RESTOCK_EXCEEDS_PURCHASED_QUANTITY/);
});

test("internal financial runners are independently secret-protected and documented", () => {
  const seller = read("app/api/internal/seller-transfers/route.ts"), refund = read("app/api/internal/refund-financials/route.ts"), example = read(".env.example");
  assert.match(seller, /SELLER_TRANSFER_CRON_SECRET/); assert.match(seller, /timingSafeEqual/);
  assert.match(refund, /REFUND_FINANCIAL_CRON_SECRET/); assert.match(refund, /timingSafeEqual/);
  assert.match(example, /^STRIPE_MODE="test"$/m);
  assert.match(example, /^SELLER_TRANSFER_CRON_SECRET=$/m);
  assert.match(example, /^REFUND_FINANCIAL_CRON_SECRET=$/m);
  assert.match(example, /^CJ_AUTOMATIC_FULFILLMENT_ENABLED="false"$/m);
});

test("deployed Stage 1-4 migrations are ordered and do not backfill financial or inventory events", () => {
  const names = readdirSync(join(process.cwd(), "prisma/migrations")).filter((name) => /^202608(13|26|27)/.test(name)).sort();
  assert.deepEqual(names, ["20260813110000_add_multi_vendor_payouts_refunds_restock", "20260813230000_add_supplier_reviews", "20260826120000_add_refund_reversal_execution", "20260826150000_add_transfer_submitted_amount", "20260827100000_add_return_restock_lifecycle"]);
  for (const name of names) {
    const sql = read(`prisma/migrations/${name}/migration.sql`);
    assert.doesNotMatch(sql, /INSERT INTO "(?:OrderGroup|RefundOperation|TransferReversal|InventoryRestockEvent)"/i);
    assert.doesNotMatch(sql, /UPDATE "(?:OrderGroup|RefundOperation|TransferReversal|InventoryRestockEvent|Product|ProductVariant)"/i);
  }
});
