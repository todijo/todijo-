import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { readSession } from "@/lib/session";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { LoyaltySettingsError, setAdminStoreLoyaltyBlock } from "@/lib/loyalty-settings";

const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, context: { params: Promise<{ storeId: string }> }) {
  try {
    assertAdminMutationRequest(request);
    const admin = await requireAdmin(prisma, await readSession());
    const { storeId } = await context.params;
    if (!storeId || storeId.length > 100) return NextResponse.json(
      { error: "INVALID_STORE" }, { status: 400, headers });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.blocked !== "boolean" || typeof body.reason !== "string")
      return NextResponse.json({ error: "INVALID_LOYALTY_ACTION" }, { status: 400, headers });
    const participation = await setAdminStoreLoyaltyBlock(prisma, admin.id, storeId,
      body.blocked, body.reason);
    return NextResponse.json({ participation }, { headers });
  } catch (error) {
    if (error instanceof MutationOriginError) return NextResponse.json(
      { error: error.message }, { status: 403, headers });
    if (error instanceof AdminAccessError || error instanceof LoyaltySettingsError)
      return NextResponse.json({ error: error.code }, { status: error.status, headers });
    return NextResponse.json({ error: "LOYALTY_UNAVAILABLE" }, { status: 503, headers });
  }
}
