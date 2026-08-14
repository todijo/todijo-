import { NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { defaultSupplierMediaProvider, importSupplierProduct } from "@/lib/suppliers/supplier-products";
import { PLATFORM_CJ_CONNECTION_ID, requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";

const MAX_BATCH_SIZE = 200;
const CJ_INTER_PRODUCT_DELAY_MS = 1100;

function identifiers(value: unknown) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function publicFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "SUPPLIER_IMPORT_FAILED";
  if (code === "SUPPLIER_PRODUCT_ALREADY_IMPORTED") return { status: "already_imported" as const, error: code };
  if (["SUPPLIER_PRODUCT_INVALID", "CJ_PRODUCT_NOT_FOUND", "CJ_PRODUCT_INVALID"].includes(code)) return { status: "invalid" as const, error: "SUPPLIER_PRODUCT_INVALID" };
  return { status: "failed" as const, error: "SUPPLIER_IMPORT_FAILED" };
}

function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function POST(request: Request) {
  try {
    const session = await readSession();
    const admin = await requirePlatformSupplierAdmin(prisma, session);
    const body = await request.json().catch(() => ({})) as { identifiers?: unknown; category?: unknown };
    const batch = identifiers(body.identifiers);
    const category = typeof body.category === "string" ? body.category.trim() : "";
    if (!batch.length || !category) return NextResponse.json({ error: "SUPPLIER_BULK_INPUT_INVALID" }, { status: 400 });
    if (batch.length > MAX_BATCH_SIZE) return NextResponse.json({ error: "SUPPLIER_BULK_LIMIT_EXCEEDED", maximum: MAX_BATCH_SIZE }, { status: 400 });
    if (batch.some((identifier) => identifier.length > 200) || category.length > 80) return NextResponse.json({ error: "SUPPLIER_BULK_INPUT_INVALID" }, { status: 400 });
    const store = await prisma.store.findUnique({ where: { ownerId: admin.id }, select: { id: true, currency: true } });
    if (!store) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });

    const provider = new CjCatalogProvider();
    const mediaProvider = defaultSupplierMediaProvider();
    const results: Array<{ identifier: string; status: "imported" | "already_imported" | "invalid" | "failed"; productId?: string; error?: string }> = [];
    for (const [index, supplierProductId] of batch.entries()) {
      try {
        const product = await importSupplierProduct(prisma, provider, mediaProvider, {
          storeId: store.id,
          connectionId: PLATFORM_CJ_CONNECTION_ID,
          ownerType: "PLATFORM",
          supplierProductId,
          sellingPrice: null,
          sellingCurrency: store.currency,
          category,
        });
        results.push({ identifier: supplierProductId, status: "imported", productId: product.id });
      } catch (error) {
        results.push({ identifier: supplierProductId, ...publicFailure(error) });
      }
      if (index < batch.length - 1) await wait(CJ_INTER_PRODUCT_DELAY_MS);
    }
    return NextResponse.json({
      ok: true,
      total: batch.length,
      imported: results.filter((item) => item.status === "imported").length,
      alreadyImported: results.filter((item) => item.status === "already_imported").length,
      invalid: results.filter((item) => item.status === "invalid").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: "SUPPLIER_ACCESS_DENIED" }, { status: error.status });
    return NextResponse.json({ error: "SUPPLIER_BULK_IMPORT_FAILED" }, { status: 502 });
  }
}
