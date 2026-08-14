import "server-only";
import type { PrismaClient } from "@prisma/client";
import { CjCatalogProvider } from "./cj-client";
import { syncSupplierProduct } from "./supplier-products";
import { PLATFORM_CJ_CONNECTION_ID } from "./supplier-access";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 20;
const DEFAULT_STALE_MINUTES = 360;
const CJ_INTER_PRODUCT_DELAY_MS = 1100;

export type AutomaticSupplierSyncResult = {
  scanned: number;
  synced: number;
  failed: number;
  results: Array<{ productId: string; ok: boolean; status?: string; error?: string }>;
};

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function syncStalePlatformCjProducts(
  db: PrismaClient,
  input: { limit?: number; staleMinutes?: number } = {},
): Promise<AutomaticSupplierSyncResult> {
  const limit = positiveInteger(input.limit, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
  const staleMinutes = positiveInteger(input.staleMinutes, DEFAULT_STALE_MINUTES, 24 * 60 * 30);
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000);
  const links = await db.supplierProductLink.findMany({
    where: {
      provider: "CJ",
      ownerType: "PLATFORM",
      connectionId: PLATFORM_CJ_CONNECTION_ID,
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lte: staleBefore } },
        { syncStatus: { in: ["ERROR", "PRICE_CHANGED", "UNAVAILABLE"] } },
      ],
    },
    orderBy: [{ lastSyncedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { productId: true },
  });

  const provider = new CjCatalogProvider();
  if (!provider.isConfigured()) throw new Error("SUPPLIER_NOT_CONFIGURED");
  const results: AutomaticSupplierSyncResult["results"] = [];
  for (const [index, link] of links.entries()) {
    try {
      const synced = await syncSupplierProduct(db, provider, link.productId);
      results.push({ productId: link.productId, ok: true, status: synced.status });
    } catch (error) {
      results.push({ productId: link.productId, ok: false, error: error instanceof Error ? error.message : "SUPPLIER_SYNC_FAILED" });
    }
    if (index < links.length - 1) await wait(CJ_INTER_PRODUCT_DELAY_MS);
  }
  return { scanned: links.length, synced: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}
