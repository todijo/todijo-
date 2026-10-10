import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { loadSellerFinanceExportRows, sellerFinanceCsv, sellerReportMonthBounds, type SellerFinanceExportRow } from "./seller-report-export";

const CURRENCY = /^[A-Z]{3}$/;

function statementSnapshot(rows: readonly SellerFinanceExportRow[]) {
  const canonicalRows = rows.map((row) => ({
    paymentDate: row.paymentDate?.toISOString() ?? null, orderId: row.orderId, currency: row.currency.toUpperCase(),
    itemSubtotalMinor: row.itemSubtotalMinor, shippingMinor: row.shippingMinor, commissionMinor: row.commissionMinor,
    commissionReversedMinor: row.commissionReversedMinor, refundedCashMerchandiseMinor: row.refundedCashMerchandiseMinor,
    refundedShippingMinor: row.refundedShippingMinor, sellerNetMinor: row.sellerNetMinor, sellerRecoveredMinor: row.sellerRecoveredMinor,
    transferStatus: row.transferStatus, transferredAt: row.transferredAt?.toISOString() ?? null,
  }));
  const json = JSON.stringify(canonicalRows);
  const totals = canonicalRows.reduce((sum, row) => {
    sum.merchandise += BigInt(row.itemSubtotalMinor); sum.shipping += BigInt(row.shippingMinor);
    sum.commission += BigInt(row.commissionMinor) - BigInt(row.commissionReversedMinor);
    sum.refunds += BigInt(row.refundedCashMerchandiseMinor) + BigInt(row.refundedShippingMinor);
    sum.sellerNet += BigInt(row.sellerNetMinor); sum.sellerRecovered += BigInt(row.sellerRecoveredMinor);
    return sum;
  }, { merchandise: BigInt(0), shipping: BigInt(0), commission: BigInt(0), refunds: BigInt(0), sellerNet: BigInt(0), sellerRecovered: BigInt(0) });
  return {
    contentHash: createHash("sha256").update(json).digest("hex"), rowCount: canonicalRows.length,
    snapshot: { rows: canonicalRows, totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toString()])) },
  };
}

function completedMonths(now: Date, createdAt: Date) {
  const first = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months: Array<{ year: number; month: number }> = [];
  for (const date = new Date(first); date < last; date.setUTCMonth(date.getUTCMonth() + 1)) months.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
  return months.reverse();
}

export async function createSellerMonthlyStatementRevisions(db: PrismaClient, input: { businessId: string; storeId: string; now?: Date }) {
  const store = await db.store.findUnique({ where: { id: input.storeId }, select: { id: true, businessId: true, currency: true, createdAt: true } });
  if (!store || store.businessId !== input.businessId) throw new Error("STATEMENT_STORE_BUSINESS_MISMATCH");
  const created: Array<{ id: string; year: number; month: number; currency: string; revision: number; rowCount: number; createdAt: Date }> = [];
  for (const { year, month } of completedMonths(input.now ?? new Date(), store.createdAt)) {
    const bounds = sellerReportMonthBounds(year, month);
    const rows = await loadSellerFinanceExportRows(db, store.id, bounds.start, bounds.end);
    const currencies = [...new Set(rows.map((row) => row.currency.toUpperCase()).filter((currency) => CURRENCY.test(currency)))];
    if (!currencies.length && CURRENCY.test(store.currency)) currencies.push(store.currency);
    for (const currency of currencies.sort()) {
      const statement = await db.$transaction(async (tx) => {
        const lockKey = `${store.id}:${year}-${String(month).padStart(2, "0")}:${currency}`;
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
        // Read after acquiring the period lock so a slower request cannot
        // append an older pre-refund snapshot after a newer corrected one.
        const currentRows = await loadSellerFinanceExportRows(tx, store.id, bounds.start, bounds.end);
        const facts = statementSnapshot(currentRows.filter((row) => row.currency.toUpperCase() === currency));
        const existing = await tx.sellerMonthlyStatement.findUnique({ where: { storeId_year_month_currency_contentHash: { storeId: store.id, year, month, currency, contentHash: facts.contentHash } } });
        if (existing) return existing;
        const latest = await tx.sellerMonthlyStatement.findFirst({ where: { storeId: store.id, year, month, currency }, orderBy: { revision: "desc" }, select: { revision: true } });
        return tx.sellerMonthlyStatement.create({ data: { businessId: input.businessId, storeId: store.id, year, month, currency, revision: (latest?.revision ?? 0) + 1, contentHash: facts.contentHash, rowCount: facts.rowCount, snapshot: facts.snapshot } });
      });
      created.push({ id: statement.id, year, month, currency, revision: statement.revision, rowCount: statement.rowCount, createdAt: statement.createdAt });
    }
  }
  return created.sort((a, b) => b.year - a.year || b.month - a.month || a.currency.localeCompare(b.currency) || a.revision - b.revision);
}

export function sellerMonthlyStatementCsv(statement: { year: number; month: number; currency: string; revision: number; snapshot: Prisma.JsonValue }, labels: Parameters<typeof sellerFinanceCsv>[1]) {
  const snapshot = statement.snapshot as { rows?: Array<Record<string, unknown>> };
  const rows: SellerFinanceExportRow[] = (snapshot.rows ?? []).map((row) => ({
    paymentDate: row.paymentDate ? new Date(String(row.paymentDate)) : null,
    orderId: String(row.orderId), currency: String(row.currency), itemSubtotalMinor: Number(row.itemSubtotalMinor), shippingMinor: Number(row.shippingMinor),
    commissionMinor: Number(row.commissionMinor), commissionReversedMinor: Number(row.commissionReversedMinor),
    refundedCashMerchandiseMinor: Number(row.refundedCashMerchandiseMinor), refundedShippingMinor: Number(row.refundedShippingMinor),
    sellerNetMinor: Number(row.sellerNetMinor), sellerRecoveredMinor: Number(row.sellerRecoveredMinor),
    transferStatus: String(row.transferStatus), transferredAt: row.transferredAt ? new Date(String(row.transferredAt)) : null,
  }));
  // This remains a non-tax accounting statement. It contains only marketplace
  // ledger facts already captured by the paid-order/refund/transfer workflows.
  return sellerFinanceCsv(rows, labels);
}
