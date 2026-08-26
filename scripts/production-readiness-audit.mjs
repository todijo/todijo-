import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const now = new Date();
const staleBefore = new Date(now.getTime() - 30 * 60_000);

const checks = [
  ["negative_product_stock", "FAIL", () => prisma.product.count({ where: { stock: { lt: 0 } } })],
  ["negative_variant_stock", "FAIL", () => prisma.productVariant.count({ where: { stock: { lt: 0 } } })],
  ["stale_transfer_submitting", "WARN", () => prisma.orderGroup.count({ where: { transferStatus: "SUBMITTING", nextTransferAttemptAt: { lt: staleBefore }, stripeTransferId: null } })],
  ["stale_refund_processing", "WARN", () => prisma.refundOperation.count({ where: { status: "PROCESSING", nextAttemptAt: { lt: staleBefore }, stripeRefundId: null } })],
  ["stale_reversal_processing", "WARN", () => prisma.transferReversal.count({ where: { status: "PROCESSING", nextAttemptAt: { lt: staleBefore }, stripeReversalId: null } })],
  ["manual_financial_action", "WARN", async () => (await Promise.all([
    prisma.orderGroup.count({ where: { transferStatus: "MANUAL_ACTION_REQUIRED" } }),
    prisma.refundOperation.count({ where: { status: "MANUAL_ACTION_REQUIRED" } }),
    prisma.transferReversal.count({ where: { status: "MANUAL_ACTION_REQUIRED" } }),
  ])).reduce((sum, count) => sum + count, 0)],
  ["marketplace_group_missing_identity", "FAIL", () => prisma.orderGroup.count({ where: { kind: "MARKETPLACE", OR: [{ storeId: null }, { storeIdSnapshot: null }, { stripeConnectedAccountId: null }] } })],
  ["cj_crossed_marketplace_accounting", "FAIL", () => prisma.orderGroup.count({ where: { kind: "CJ_PLATFORM", OR: [{ storeId: { not: null } }, { stripeConnectedAccountId: { not: null } }, { sellerNetAmountMinor: { not: 0 } }, { stripeTransferId: { not: null } }] } })],
  ["impossible_group_accounting", "FAIL", () => scalar(Prisma.sql`SELECT COUNT(*)::int AS count FROM "OrderGroup" WHERE "sellerRecoveredMinor" > "sellerNetAmountMinor" OR "commissionReversedMinor" > "platformFeeAmountMinor" OR "refundedMerchandiseMinor" > "itemSubtotalMinor"`)],
  ["over_refunded_item_quantity", "FAIL", () => scalar(Prisma.sql`SELECT COUNT(*)::int AS count FROM (SELECT ria."orderItemId" FROM "RefundItemAllocation" ria JOIN "OrderItem" oi ON oi.id = ria."orderItemId" GROUP BY ria."orderItemId", oi.quantity HAVING SUM(ria.quantity) > oi.quantity) violations`)],
  ["over_reversed_transfer", "FAIL", () => scalar(Prisma.sql`SELECT COUNT(*)::int AS count FROM (SELECT tr."orderGroupId" FROM "TransferReversal" tr JOIN "OrderGroup" og ON og.id = tr."orderGroupId" GROUP BY tr."orderGroupId", og."transferSubmittedAmountMinor", og."sellerNetAmountMinor" HAVING SUM(tr."amountMinor") > COALESCE(og."transferSubmittedAmountMinor", og."sellerNetAmountMinor")) violations`)],
  ["over_restocked_item_quantity", "FAIL", () => scalar(Prisma.sql`SELECT COUNT(*)::int AS count FROM (SELECT ire."orderItemId" FROM "InventoryRestockEvent" ire JOIN "OrderItem" oi ON oi.id = ire."orderItemId" WHERE ire.status = 'RESTOCKED' GROUP BY ire."orderItemId", oi.quantity HAVING SUM(ire.quantity) > oi.quantity) violations`)],
  ["invalid_stage4_return_identity", "FAIL", () => scalar(Prisma.sql`SELECT COUNT(*)::int AS count FROM "InventoryRestockEvent" ire JOIN "RefundOperation" ro ON ro.id = ire."refundOperationId" JOIN "OrderItem" oi ON oi.id = ire."orderItemId" JOIN "OrderGroup" og ON og.id = oi."orderGroupId" WHERE ire."lifecycleKey" IS NOT NULL AND (ire."lifecycleKey" <> ('return:' || ire."refundOperationId" || ':' || ire."orderItemId") OR ro.status <> 'COMPLETED' OR og.kind <> 'MARKETPLACE') AND ire.status NOT IN ('NOT_APPLICABLE')`)],
];

async function scalar(query) {
  const rows = await prisma.$queryRaw(query);
  return Number(rows[0]?.count ?? 0);
}

let failed = false;
try {
  console.log(`Todijo production readiness audit (read-only) at ${now.toISOString()}`);
  for (const [name, severity, run] of checks) {
    const count = await run();
    const result = count === 0 ? "PASS" : severity;
    if (result === "FAIL") failed = true;
    console.log(`${result} ${name}: ${count}`);
  }
  console.log(failed ? "FAIL Read-only inconsistencies require explicit investigation; no repairs were attempted." : "PASS No failing invariant was detected; warnings still require operational review.");
} catch (error) {
  failed = true;
  console.error("FAIL audit_unavailable:", error instanceof Error ? error.name : "UNKNOWN_ERROR");
} finally {
  await prisma.$disconnect();
}
process.exitCode = failed ? 2 : 0;
