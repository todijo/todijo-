import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { readSession } from "@/lib/session";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { LoyaltySettingsError, loyaltyActivationReady, readLoyaltySettings, updateLoyaltySettings } from "@/lib/loyalty-settings";
import { storeLoyaltyAccounting } from "@/lib/loyalty-analytics";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403, headers });
  if (error instanceof AdminAccessError || error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
  return NextResponse.json({ error: "LOYALTY_UNAVAILABLE" }, { status: 503, headers });
}
export async function GET(_request: Request) {
  try {
    await requireAdmin(prisma, await readSession());
    const [settings, history, globalAccounting] = await Promise.all([
      readLoyaltySettings(prisma),
      prisma.loyaltySettingsChange.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      storeLoyaltyAccounting(prisma, null),
    ]);
    return NextResponse.json({ settings, history, globalAccounting,
      activationReady: loyaltyActivationReady() }, { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    assertAdminMutationRequest(request);
    const admin = await requireAdmin(prisma, await readSession());
    const settings = await updateLoyaltySettings(prisma, admin.id, await request.json().catch(() => null));
    return NextResponse.json({ settings }, { headers });
  } catch (error) { return failure(error); }
}
