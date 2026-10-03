import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { connectedAccountStatus, retrieveConnectedAccount, stripeErrorDiagnostic } from "@/lib/stripe";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    await requireBusinessOwner(prisma,session.userId);
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    if (!seller.stripeAccountId) return NextResponse.json({ connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false });
    const account = await retrieveConnectedAccount(seller.stripeAccountId);
    const status = connectedAccountStatus(account);
    await prisma.user.update({ where: { id: session.userId }, data: status });
    return NextResponse.json({ connected: true, accountId: account.id, onboardingComplete: status.stripeOnboardingComplete, chargesEnabled: status.stripeChargesEnabled, payoutsEnabled: status.stripePayoutsEnabled });
  } catch (error) {
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    console.error("Stripe Connect status failed", stripeErrorDiagnostic(error));
    return NextResponse.json({ error: "STRIPE_CONNECT_UNAVAILABLE" }, { status: 502 });
  }
}
