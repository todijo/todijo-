import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { setSellerDropshippingPermission, SupplierAccessError } from "@/lib/suppliers/supplier-access";

export async function PATCH(request: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json() as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") throw new SupplierAccessError("INVALID_PERMISSION", 400);
    const result = await setSellerDropshippingPermission(prisma, { userId: admin.id }, (await context.params).storeId, body.enabled);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SupplierAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
