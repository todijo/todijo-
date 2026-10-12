import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { connectedAccountStatus, retrieveConnectedAccount, stripeErrorDiagnostic } from "@/lib/stripe";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { reconcilePendingSellerStoreActivationsForOwner } from "@/lib/seller-store-activation";

export const runtime = "nodejs";

export async function GET() {
  const correlationId = randomUUID();
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  let hasStoredAccount = false;
  try {
    await requireBusinessOwner(prisma,session.userId);
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    hasStoredAccount = Boolean(seller.stripeAccountId);
    if (!seller.stripeAccountId) {
      await prisma.user.updateMany({ where: { id: session.userId, stripeAccountId: null }, data: { stripeOnboardingComplete: false, stripeChargesEnabled: false, stripePayoutsEnabled: false } });
      revalidateTag(PUBLIC_STORES_CACHE_TAG);
      return NextResponse.json({ connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false, storeActivated: false });
    }
    const account = await retrieveConnectedAccount(seller.stripeAccountId);
    if (account.object !== "account" || account.id !== seller.stripeAccountId) throw new Error("Stripe returned a different connected account.");
    const status = connectedAccountStatus(account);
    const reconciled = await prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({ where: { id: session.userId, stripeAccountId: seller.stripeAccountId }, data: status });
      if (updated.count !== 1) return { updated: false, storeActivated: false };
      const activation = await reconcilePendingSellerStoreActivationsForOwner(tx, session.userId);
      return { updated: true, storeActivated: activation.activatedStoreIds.length > 0, activation };
    }, { isolationLevel: "Serializable" });
    if (!reconciled.updated) return NextResponse.json({ error: "STRIPE_ACCOUNT_CHANGED" }, { status: 409 });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ connected: true, accountId: account.id, onboardingComplete: status.stripeOnboardingComplete, chargesEnabled: status.stripeChargesEnabled, payoutsEnabled: status.stripePayoutsEnabled, storeActivated: reconciled.storeActivated, activation: reconciled.activation });
  } catch (error) {
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    console.error("Stripe Connect status failed", stripeErrorDiagnostic(error, { correlationId, route: "GET /api/stripe/connect/status", sellerId: session.userId, hasStoredAccount }));
    return NextResponse.json({ error: "STRIPE_CONNECT_UNAVAILABLE" }, { status: 502 });
  }
}
