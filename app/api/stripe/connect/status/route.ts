import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { connectedAccountStatus, retrieveConnectedAccount } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    if (!seller.stripeAccountId) return NextResponse.json({ connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false });
    const account = await retrieveConnectedAccount(seller.stripeAccountId);
    const status = connectedAccountStatus(account);
    await prisma.user.update({ where: { id: session.userId }, data: status });
    return NextResponse.json({ connected: true, accountId: account.id, onboardingComplete: status.stripeOnboardingComplete, chargesEnabled: status.stripeChargesEnabled, payoutsEnabled: status.stripePayoutsEnabled });
  } catch (error) {
    console.error("Stripe Connect status failed", error);
    return NextResponse.json({ error: "Unable to refresh Stripe status." }, { status: 502 });
  }
}
