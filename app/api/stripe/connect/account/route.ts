import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { createConnectedAccount, createConnectedAccountLink } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const session = await readSession();
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    let accountId = seller.stripeAccountId;
    if (!accountId) {
      const account = await createConnectedAccount({ userId: seller.id, email: seller.email });
      accountId = account.id;
      await prisma.user.update({ where: { id: seller.id }, data: { stripeAccountId: accountId } });
    }
    const url = await createConnectedAccountLink(accountId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Stripe Connect onboarding failed", error);
    return NextResponse.json({ error: "Unable to start Stripe onboarding." }, { status: 502 });
  }
}
