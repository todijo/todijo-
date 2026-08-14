import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePlatformSupplierAdmin } from "@/lib/suppliers/supplier-access";
import { AdminAccessError } from "@/lib/admin-access";
import { syncStalePlatformCjProducts } from "@/lib/suppliers/automatic-sync";

export async function POST(request: Request) {
  try {
    const session = await readSession();
    await requirePlatformSupplierAdmin(prisma, session);
    const body = await request.json().catch(() => ({})) as { limit?: unknown; staleMinutes?: unknown };
    const result = await syncStalePlatformCjProducts(prisma, {
      limit: Number(body.limit) || undefined,
      staleMinutes: Number(body.staleMinutes) || undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: "SUPPLIER_ACCESS_DENIED" }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "SUPPLIER_SYNC_FAILED" }, { status: 502 });
  }
}
