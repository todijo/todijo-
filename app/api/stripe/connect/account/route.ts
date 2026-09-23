import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSellerRequestSession } from "@/lib/seller-request-session";
import { createConnectedAccount, createConnectedAccountLink } from "@/lib/stripe";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError } from "@/lib/admin-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await readSellerRequestSession(request);
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    if (request.headers.has("authorization")) await assertSellerActivity(prisma, session.userId);
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
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Stripe Connect onboarding failed", error);
    return NextResponse.json({ error: "Unable to start Stripe onboarding." }, { status: 502 });
  }
}
