import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { LoyaltySettingsError, readLoyaltySettings, setStoreLoyaltyParticipation } from "@/lib/loyalty-settings";
import { sellerLoyaltyAccounting } from "@/lib/loyalty-analytics";
import { orderLoyaltyFundingTrace } from "@/lib/loyalty-order-reconciliation";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";

const headers = { "Cache-Control": "private, no-store" };
function isTrustedMutationRequest(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
async function sellerStore(request: Request) {
  const session = await readSession();
  if (!session) throw new LoyaltySettingsError("AUTH_REQUIRED", 401);
  await assertSellerActivity(prisma, session.userId);
  await requireBusinessOwner(prisma,session.userId);
  const requestedStoreId=new URL(request.url).searchParams.get("store");
  const store = await prisma.store.findFirst({ where: { ownerId: session.userId,...(requestedStoreId?{id:requestedStoreId}:{}) }, orderBy:{createdAt:"asc"}, select: {
    id: true, loyaltyEnabled: true, loyaltyBlockedAt: true,
  } });
  if (!store) throw new LoyaltySettingsError("STORE_NOT_FOUND", 404);
  return { userId: session.userId, store };
}
function failure(error: unknown) {
  if (error instanceof LoyaltySettingsError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
  if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status,headers});
  return NextResponse.json({ error: "LOYALTY_UNAVAILABLE" }, { status: 503, headers });
}
export async function GET(request: Request) {
  try {
    const { store } = await sellerStore(request);
    const [settings, accounting] = await Promise.all([
      readLoyaltySettings(prisma), sellerLoyaltyAccounting(prisma, store.id),
    ]);
    const orderId = new URL(request.url).searchParams.get("orderId")?.trim() ?? "";
    if (orderId.length > 100) throw new LoyaltySettingsError("INVALID_LOYALTY_LOOKUP", 400);
    const order = orderId ? await orderLoyaltyFundingTrace(prisma, orderId, store.id) : null;
    return NextResponse.json({ settings: { enabled: settings.enabled, rateBps: settings.rateBps },
      participation: { enabled: store.loyaltyEnabled, blocked: Boolean(store.loyaltyBlockedAt) },
      accounting, order }, { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) throw new LoyaltySettingsError("INVALID_MUTATION_ORIGIN", 403);
    const { userId, store } = await sellerStore(request);
    const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
    if (typeof body?.enabled !== "boolean") throw new LoyaltySettingsError("INVALID_PARTICIPATION");
    const participation = await setStoreLoyaltyParticipation(prisma, userId, store.id, body.enabled);
    return NextResponse.json({ participation }, { headers });
  } catch (error) { return failure(error); }
}
