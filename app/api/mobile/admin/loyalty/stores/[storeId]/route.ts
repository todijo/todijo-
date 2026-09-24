import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, mobileAdminFailure } from "@/lib/mobile-admin-context";
import { LoyaltySettingsError, setAdminStoreLoyaltyBlock } from "@/lib/loyalty-settings";

export async function PATCH(request: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    const admin = await requireMobileAdmin(request);
    const body = await request.json().catch(() => null) as { blocked?: unknown; reason?: unknown } | null;
    if (typeof body?.blocked !== "boolean" || typeof body.reason !== "string") throw new LoyaltySettingsError("INVALID_STORE_POLICY");
    const { storeId } = await context.params;
    const participation = await setAdminStoreLoyaltyBlock(prisma, admin.id, storeId, body.blocked, body.reason);
    return NextResponse.json({ participation }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileAdminFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
