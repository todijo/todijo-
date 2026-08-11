import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { setSellerDropshippingPermission, SupplierAccessError } from "@/lib/suppliers/supplier-access";

export async function PATCH(request: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    const session = await readSession();
    const { storeId } = await context.params;
    const body = await request.json() as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") throw new SupplierAccessError("INVALID_PERMISSION", 400);
    return NextResponse.json({ ok: true, ...(await setSellerDropshippingPermission(prisma, session, storeId, body.enabled)) });
  } catch (error) {
    const status = error instanceof SupplierAccessError ? error.status : 403;
    return NextResponse.json({ error: error instanceof Error ? error.message : "SUPPLIER_ACCESS_DENIED" }, { status });
  }
}
