import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { createConnectedAccount, createConnectedAccountLink, stripeErrorDiagnostic } from "@/lib/stripe";
import { startStripeConnectOnboarding } from "@/lib/stripe-connect-onboarding";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";

export const runtime = "nodejs";

export async function POST() {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    await requireBusinessOwner(prisma,session.userId);
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    const url = await startStripeConnectOnboarding(prisma, seller, {
      createAccount: createConnectedAccount,
      createAccountLink: createConnectedAccountLink,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    console.error("Stripe Connect onboarding failed", stripeErrorDiagnostic(error));
    return NextResponse.json({ error: "STRIPE_CONNECT_UNAVAILABLE" }, { status: 502 });
  }
}
